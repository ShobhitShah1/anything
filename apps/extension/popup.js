import { DEFAULT_APP_URL, normalizeAppUrl } from './core.mjs';

await chrome.runtime.sendMessage({ type: 'anything:syncFolders' }).catch(() => {});
const settings = await chrome.storage.local.get([
  'appUrl', 'copyEnabled', 'queue', 'lastError', 'pendingCapture', 'folders', 'theme', 'wheelFolders',
]);
if (settings.theme === 'light' || settings.theme === 'dark')
  document.documentElement.dataset.theme = settings.theme;

const field = document.querySelector('#app-url');
const autoCopy = document.querySelector('#auto-copy');
const status = document.querySelector('#status');
const wheel = document.querySelector('#folder-wheel');
const manual = document.querySelector('#manual-url');
const manualTarget = document.querySelector('#manual-target');
const folders = settings.folders || [];
const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
chrome.runtime.sendMessage({ type: 'anything:trackPointer' }).catch(() => {});
field.value = settings.appUrl || DEFAULT_APP_URL;
autoCopy.checked = !!settings.copyEnabled;

const pageUrl = /^https?:\/\//i.test(activeTab?.url || '') ? activeTab.url : '';
let captureText = settings.pendingCapture || pageUrl;
const parseUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};
const displayCapture = () => {
  const url = parseUrl(captureText);
  document.querySelector('#draft-label').textContent = settings.pendingCapture
    ? url ? 'COPIED LINK' : 'SELECTED TEXT'
    : 'CURRENT PAGE';
  document.querySelector('#draft-title').textContent =
    (!settings.pendingCapture && captureText === pageUrl ? activeTab?.title : '') ||
    url?.hostname || captureText.slice(0, 72) || 'This page can’t be saved';
  document.querySelector('#draft-url').textContent = url
    ? `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
    : captureText ? 'Selected text ready to file.' : 'Chrome protects browser settings pages.';
  manualTarget.hidden = !!captureText;
  document.querySelector('#capture-heading').textContent = captureText
    ? 'Where should this go?'
    : 'Nothing to save here';
  document.querySelector('#capture-subtitle').textContent = captureText
    ? 'Pick a folder and it saves straight into your collection.'
    : 'Paste a web link below, or switch to a regular website.';
};
displayCapture();

let visibleFolderIds = new Set(
  (Array.isArray(settings.wheelFolders) ? settings.wheelFolders : folders.slice(0, 7).map(({ id }) => id))
    .filter((id) => folders.some((folder) => folder.id === id))
    .slice(0, 7),
);
const svgNS = 'http://www.w3.org/2000/svg';
const polar = (radius, angle) => [150 + radius * Math.cos(angle), 150 + radius * Math.sin(angle)];
const point = (pair) => `${pair[0].toFixed(2)} ${pair[1].toFixed(2)}`;

async function save(folder, group) {
  if (!captureText.trim() || group.getAttribute('aria-disabled') === 'true') return;
  group.setAttribute('aria-disabled', 'true');
  status.textContent = `Saving to ${folder.name}…`;
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'anything:save',
      text: captureText,
      folderId: folder.id || null,
    });
    status.textContent = response.ok ? `Added to ${folder.name}` : response.error;
    if (!response.ok) group.removeAttribute('aria-disabled');
  } catch (error) {
    status.textContent = error.message;
    group.removeAttribute('aria-disabled');
  }
}

function renderWheel() {
  wheel.querySelectorAll('.wheel-slice').forEach((slice) => slice.remove());
  const choices = [...folders.filter((folder) => visibleFolderIds.has(folder.id)), { id: '', name: 'No folder' }];
  choices.forEach((folder, index) => {
    const start = (index / choices.length) * Math.PI * 2 - Math.PI / 2 + 0.025;
    const end = ((index + 1) / choices.length) * Math.PI * 2 - Math.PI / 2 - 0.025;
    const large = end - start > Math.PI ? 1 : 0;
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', `M ${point(polar(130, start))} A 130 130 0 ${large} 1 ${point(polar(130, end))} L ${point(polar(54, end))} A 54 54 0 ${large} 0 ${point(polar(54, start))} Z`);
    const group = document.createElementNS(svgNS, 'g');
    group.classList.add('wheel-slice');
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', captureText.trim() ? '0' : '-1');
    if (!captureText.trim()) group.setAttribute('aria-disabled', 'true');
    group.setAttribute('aria-label', `Save to ${folder.name}`);
    group.style.animationDelay = `${index * 24}ms`;
    group.append(path);
    const mid = (start + end) / 2;
    const [x, y] = polar(96, mid);
    const title = document.createElementNS(svgNS, 'text');
    title.classList.add('folder-name');
    title.setAttribute('x', x.toFixed(2));
    title.setAttribute('y', (y + 3).toFixed(2));
    title.textContent = folder.name.slice(0, 16);
    const hint = document.createElementNS(svgNS, 'text');
    hint.classList.add('folder-hint');
    hint.setAttribute('x', x.toFixed(2));
    hint.setAttribute('y', (y + 14).toFixed(2));
    hint.textContent = !captureText.trim() ? 'PASTE LINK' : folder.id ? 'TAP TO SAVE' : 'UNFILED';
    group.append(title, hint);
    group.addEventListener('click', () => save(folder, group));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void save(folder, group);
      }
    });
    wheel.append(group);
  });
}

const options = document.querySelector('#folder-options');
function renderFolderOptions() {
  options.replaceChildren();
  if (!folders.length) {
    options.textContent = 'Your folders will appear here after you open Anything.';
    return;
  }
  for (const folder of folders) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = visibleFolderIds.has(folder.id);
    checkbox.addEventListener('change', async () => {
      if (checkbox.checked && visibleFolderIds.size >= 7) {
        checkbox.checked = false;
        status.textContent = 'The wheel fits up to 7 folders. Hide one to add another.';
        return;
      }
      if (checkbox.checked) visibleFolderIds.add(folder.id);
      else visibleFolderIds.delete(folder.id);
      await chrome.storage.local.set({ wheelFolders: [...visibleFolderIds] });
      renderWheel();
    });
    const name = document.createElement('span');
    name.textContent = folder.name;
    label.append(checkbox, name);
    options.append(label);
  }
}
renderWheel();
renderFolderOptions();

document.querySelector('#customize-wheel').addEventListener('click', (event) => {
  const panel = document.querySelector('#wheel-customization');
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
  event.currentTarget.textContent = panel.hidden ? 'Customize' : 'Done';
});
manual.addEventListener('input', () => {
  captureText = parseUrl(manual.value.trim()) ? manual.value.trim() : '';
  displayCapture();
  renderWheel();
});
document.querySelector('#empty-folders').hidden = folders.length > 0;
document.querySelector('#open-anything').addEventListener('click', () => {
  chrome.tabs.create({ url: settings.appUrl || DEFAULT_APP_URL });
});
status.textContent = settings.lastError || (settings.queue?.length
  ? `${settings.queue.length} saves waiting for Anything`
  : captureText ? 'Tap a folder to save this item.' : 'The wheel is ready when you paste a link.');

document.querySelector('#settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const appUrl = normalizeAppUrl(field.value);
    const origin = `${new URL(appUrl).origin}/*`;
    if (!(await chrome.permissions.request({ origins: [origin] })))
      throw new Error('Allow access to your Anything address to connect.');
    await chrome.storage.local.set({ appUrl, lastError: '' });
    const response = await chrome.runtime.sendMessage({ type: 'anything:settings' });
    status.textContent = response.ok ? 'Connected. New saves go to this collection.' : response.error;
  } catch (error) {
    status.textContent = error.message;
  }
});

autoCopy.addEventListener('change', async () => {
  try {
    if (
      autoCopy.checked &&
      !(await chrome.permissions.request({
        origins: ['http://*/*', 'https://*/*'],
        permissions: ['clipboardRead'],
      }))
    ) {
      autoCopy.checked = false;
      throw new Error('Auto-save stayed off. Right-click saving still works.');
    }
    await chrome.storage.local.set({ copyEnabled: autoCopy.checked });
    const response = await chrome.runtime.sendMessage({ type: 'anything:settings' });
    if (!response.ok) throw new Error(response.error);
    status.textContent = autoCopy.checked
      ? 'Copied links wait here to file. Other copied text saves automatically.'
      : 'Automatic copy capture is off.';
  } catch (error) {
    autoCopy.checked = false;
    await chrome.storage.local.set({ copyEnabled: false });
    status.textContent = error.message;
  }
});
