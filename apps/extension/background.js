import { DEFAULT_APP_URL, normalizeAppUrl, isAppPage, appendCapture } from './core.mjs';

let writes = Promise.resolve();
let flushing = false;
const origins = ['http://*/*', 'https://*/*'];

function changeQueue(update) {
  const task = writes.then(async () => {
    const { queue = [] } = await chrome.storage.local.get('queue');
    const next = update(queue);
    await chrome.storage.local.set({ queue: next });
    await chrome.action.setBadgeText({ text: next.length ? String(next.length) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#555c72' });
    return next;
  });
  writes = task.catch(() => {});
  return task;
}

async function flush() {
  if (flushing) return;
  flushing = true;
  let retry = false;
  try {
    await writes;
    const { queue = [], appUrl = DEFAULT_APP_URL } = await chrome.storage.local.get([
      'queue',
      'appUrl',
    ]);
    if (!queue.length) return;
    const address = normalizeAppUrl(appUrl);
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => isAppPage(candidate.pendingUrl || candidate.url, address));
    if (!tab) {
      await chrome.tabs.create({ url: address, active: false });
      return;
    }
    if (tab.status === 'loading') return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['bridge.js'] });
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'anything:deliver',
      entries: queue,
    });
    const sentIds = new Set(queue.map((entry) => entry.id));
    const saved = new Set((response?.savedIds || []).filter((id) => sentIds.has(id)));
    if (saved.size) {
      const remaining = await changeQueue((entries) =>
        entries.filter((entry) => !saved.has(entry.id)),
      );
      retry = remaining.length > 0;
      await chrome.storage.local.set({ lastError: '' });
    }
  } catch (error) {
    await chrome.storage.local.set({
      lastError: `Captures are queued. ${error.message || 'Open Anything to finish saving.'}`,
    });
  } finally {
    flushing = false;
    if (retry) void flush();
  }
}

async function capture(text, folderId) {
  await changeQueue((queue) => appendCapture(queue, text, folderId));
  void flush();
}

async function openPagePicker(tabId, text, info) {
  if (typeof text !== 'string' || !text.trim() || text.length > 50_000)
    throw new Error('Choose a capture between 1 and 50,000 characters.');
  await syncAppFolders();
  await chrome.storage.local.set({ pendingCapture: text.trim() });
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [{ linkUrl: info.linkUrl || '', srcUrl: info.srcUrl || '' }],
    func: ({ linkUrl, srcUrl }) => {
      if (window.__anythingContextPoint) return;
      const target = linkUrl
        ? [...document.links].find((link) => link.href === linkUrl)
        : srcUrl
          ? [...document.images].find((image) => image.currentSrc === srcUrl || image.src === srcUrl)
          : null;
      const selection = window.getSelection();
      const rect = target?.getBoundingClientRect() ||
        (selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null);
      window.__anythingContextPoint = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: innerWidth / 2, y: innerHeight / 2 };
    },
  });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['widget.js'] });
}

async function configureCopyCapture() {
  const { copyEnabled = false } = await chrome.storage.local.get('copyEnabled');
  const registrations = await chrome.scripting.getRegisteredContentScripts({
    ids: ['anything-copy'],
  });
  const allowed =
    copyEnabled && (await chrome.permissions.contains({ origins, permissions: ['clipboardRead'] }));
  if (!allowed) {
    if (registrations.length)
      await chrome.scripting.unregisterContentScripts({ ids: ['anything-copy'] });
    if (copyEnabled) await chrome.storage.local.set({ copyEnabled: false });
    return;
  }
  if (registrations.length) return;
  await chrome.scripting.registerContentScripts([
    {
      id: 'anything-copy',
      js: ['copy.js'],
      matches: origins,
      allFrames: true,
      runAt: 'document_start',
      persistAcrossSessions: true,
    },
  ]);
  for (const tab of await chrome.tabs.query({})) {
    if (/^https?:\/\//.test(tab.url || ''))
      void chrome.scripting
        .executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['copy.js'] })
        .catch(() => {});
  }
}

async function removeLegacyAppBridge() {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: ['anything-bridge'] });
  if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: ['anything-bridge'] });
}

async function syncAppFolders() {
  const { appUrl = DEFAULT_APP_URL } = await chrome.storage.local.get('appUrl');
  const origin = `${new URL(normalizeAppUrl(appUrl)).origin}/*`;
  if (!(await chrome.permissions.contains({ origins: [origin] }))) return;
  const tab = (await chrome.tabs.query({})).find(
    (candidate) => candidate.status !== 'loading' && isAppPage(candidate.url, appUrl),
  );
  if (!tab?.id) return;
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: () => {
      let folders = [];
      try {
        folders = JSON.parse(localStorage.getItem('anything_folders_v1') || '[]');
      } catch {}
      return { folders, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' };
    },
  });
  const result = injected?.result;
  if (!Array.isArray(result?.folders)) return;
  const values = {
    folders: result.folders
      .slice(0, 100)
      .filter(
        (folder) =>
          typeof folder?.id === 'string' &&
          folder.id.length <= 100 &&
          typeof folder?.name === 'string' &&
          folder.name.length <= 120,
      )
      .map(({ id, name }) => ({ id, name })),
  };
  if (result.theme === 'light' || result.theme === 'dark') values.theme = result.theme;
  await chrome.storage.local.set(values);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() =>
    chrome.contextMenus.create({
      id: 'anything-save',
      title: 'Save to Anything',
      contexts: ['page', 'selection', 'link', 'image'],
      documentUrlPatterns: origins,
    }),
  );
  void configureCopyCapture();
  void removeLegacyAppBridge();
});
chrome.runtime.onStartup.addListener(() => {
  void configureCopyCapture();
  void removeLegacyAppBridge();
  void flush();
});
chrome.permissions.onRemoved.addListener(() => {
  void configureCopyCapture();
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'anything-save') return;
  void openPagePicker(tab.id, info.selectionText || info.srcUrl || info.linkUrl || info.pageUrl, info).catch(
    async (error) => {
      await chrome.storage.local.set({ lastError: error.message });
      await chrome.action.setBadgeText({ text: '!' });
    },
  );
});
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === 'complete') void flush();
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  const work = async () => {
    const settings = await chrome.storage.local.get(['appUrl', 'copyEnabled']);
    const appUrl = settings.appUrl || DEFAULT_APP_URL;
    const fromPopup = sender.url === chrome.runtime.getURL('popup.html');
    if (message.type === 'anything:settings' && fromPopup) {
      await configureCopyCapture();
      await syncAppFolders();
      void flush();
      return;
    }
    if (message.type === 'anything:syncFolders' && fromPopup) {
      await syncAppFolders();
      return;
    }
    if (message.type === 'anything:trackPointer' && fromPopup) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && /^https?:\/\//.test(tab.url || ''))
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['pointer.js'] });
      return;
    }
    if (message.type === 'anything:capture' && fromPopup) {
      await capture(message.text);
      return;
    }
    if (message.type === 'anything:save' && (fromPopup || sender.tab)) {
      const folders = (await chrome.storage.local.get('folders')).folders || [];
      const folderId =
        message.folderId === null || !folders.some((folder) => folder.id === message.folderId)
          ? null
          : message.folderId;
      await capture(message.text, folderId);
      await chrome.storage.local.set({ pendingCapture: '' });
      return;
    }
    if (message.type === 'anything:copied' && sender.tab && settings.copyEnabled) {
      if (!isAppPage(sender.tab.url, appUrl)) {
        if (/^https?:\/\/\S+$/i.test(message.text.trim()) && message.text.length <= 2048)
          await chrome.storage.local.set({ pendingCapture: message.text.trim() });
        else await capture(message.text);
      }
      return;
    }
    throw new Error('This capture source is not enabled.');
  };
  work()
    .then(() => respond({ ok: true }))
    .catch(async (error) => {
      await chrome.storage.local.set({ lastError: error.message });
      await chrome.action.setBadgeText({ text: '!' });
      respond({ ok: false, error: error.message });
    });
  return true;
});
