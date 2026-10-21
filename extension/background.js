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
    const { queue = [], appUrl = DEFAULT_APP_URL } = await chrome.storage.local.get(['queue', 'appUrl']);
    if (!queue.length) return;
    const address = normalizeAppUrl(appUrl);
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(candidate => isAppPage(candidate.pendingUrl || candidate.url, address));
    if (!tab) { await chrome.tabs.create({ url: address, active: false }); return; }
    if (tab.status === 'loading') return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['bridge.js'] });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'anything:deliver', entries: queue });
    const sentIds = new Set(queue.map(entry => entry.id));
    const saved = new Set((response?.savedIds || []).filter(id => sentIds.has(id)));
    if (saved.size) {
      const remaining = await changeQueue(entries => entries.filter(entry => !saved.has(entry.id)));
      retry = remaining.length > 0;
      await chrome.storage.local.set({ lastError: '' });
    }
  } catch (error) {
    await chrome.storage.local.set({ lastError: `Captures are queued. ${error.message || 'Open Anything to finish saving.'}` });
  } finally {
    flushing = false;
    if (retry) void flush();
  }
}

async function capture(text) {
  await changeQueue(queue => appendCapture(queue, text));
  void flush();
}

async function configureCopyCapture() {
  const { copyEnabled = false } = await chrome.storage.local.get('copyEnabled');
  const registrations = await chrome.scripting.getRegisteredContentScripts({ ids: ['anything-copy'] });
  const allowed = copyEnabled && await chrome.permissions.contains({ origins, permissions: ['clipboardRead'] });
  if (!allowed) {
    if (registrations.length) await chrome.scripting.unregisterContentScripts({ ids: ['anything-copy'] });
    if (copyEnabled) await chrome.storage.local.set({ copyEnabled: false });
    return;
  }
  if (registrations.length) return;
  await chrome.scripting.registerContentScripts([{ id: 'anything-copy', js: ['copy.js'], matches: origins, allFrames: true, runAt: 'document_start', persistAcrossSessions: true }]);
  for (const tab of await chrome.tabs.query({})) {
    if (/^https?:\/\//.test(tab.url || '')) void chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['copy.js'] }).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({ id: 'anything-save', title: 'Save to Anything', contexts: ['page', 'selection', 'link', 'image'], documentUrlPatterns: origins }));
  void configureCopyCapture();
});
chrome.runtime.onStartup.addListener(() => { void configureCopyCapture(); void flush(); });
chrome.permissions.onRemoved.addListener(() => { void configureCopyCapture(); });
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId !== 'anything-save') return;
  void capture(info.selectionText || info.srcUrl || info.linkUrl || info.pageUrl).catch(async error => {
    await chrome.storage.local.set({ lastError: error.message });
    await chrome.action.setBadgeText({ text: '!' });
  });
});
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === 'complete') void flush(); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  const work = async () => {
    const settings = await chrome.storage.local.get(['appUrl', 'copyEnabled']);
    const appUrl = settings.appUrl || DEFAULT_APP_URL;
    const fromPopup = sender.url === chrome.runtime.getURL('popup.html');
    if (message.type === 'anything:settings' && fromPopup) { await configureCopyCapture(); void flush(); return; }
    if (message.type === 'anything:ready' && isAppPage(sender.tab?.url, appUrl)) { void flush(); return; }
    if (message.type === 'anything:capture' && fromPopup) { await capture(message.text); return; }
    if (message.type === 'anything:copied' && sender.tab && settings.copyEnabled) { if (!isAppPage(sender.tab.url, appUrl)) await capture(message.text); return; }
    throw new Error('This capture source is not enabled.');
  };
  work().then(() => respond({ ok: true })).catch(async error => {
    await chrome.storage.local.set({ lastError: error.message });
    await chrome.action.setBadgeText({ text: '!' });
    respond({ ok: false, error: error.message });
  });
  return true;
});
