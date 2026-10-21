import { DEFAULT_APP_URL, normalizeAppUrl } from './core.mjs';
const field = document.querySelector('#app-url');
const autoCopy = document.querySelector('#auto-copy');
const status = document.querySelector('#status');
const settings = await chrome.storage.local.get(['appUrl', 'copyEnabled', 'queue', 'lastError']);
field.value = settings.appUrl || DEFAULT_APP_URL;
autoCopy.checked = !!settings.copyEnabled;
status.textContent = settings.lastError || (settings.queue?.length ? `${settings.queue.length} waiting for Anything` : 'Right-click a page, link, image or selection to save.');
document.querySelector('#settings').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const appUrl = normalizeAppUrl(field.value);
    const origin = `${new URL(appUrl).origin}/*`;
    if (!await chrome.permissions.request({ origins: [origin] })) throw new Error('Allow access to your Anything address to connect.');
    await chrome.storage.local.set({ appUrl, lastError: '' });
    const response = await chrome.runtime.sendMessage({ type: 'anything:settings' });
    status.textContent = response.ok ? 'Connected. New saves go to this collection.' : response.error;
  } catch (error) { status.textContent = error.message; }
});
autoCopy.addEventListener('change', async () => {
  try {
    if (autoCopy.checked && !await chrome.permissions.request({ origins: ['http://*/*', 'https://*/*'], permissions: ['clipboardRead'] })) { autoCopy.checked = false; throw new Error('Auto-save stayed off. Right-click saving still works.'); }
    await chrome.storage.local.set({ copyEnabled: autoCopy.checked });
    const response = await chrome.runtime.sendMessage({ type: 'anything:settings' });
    if (!response.ok) throw new Error(response.error);
    status.textContent = autoCopy.checked ? 'Text you copy in websites will be saved automatically.' : 'Automatic copy capture is off.';
  } catch (error) { autoCopy.checked = false; await chrome.storage.local.set({ copyEnabled: false }); status.textContent = error.message; }
});
document.querySelector('#save-page').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/^https?:\/\//.test(tab?.url || '')) throw new Error('Open a website to save this page.');
    const response = await chrome.runtime.sendMessage({ type: 'anything:capture', text: tab.url });
    status.textContent = response.ok ? 'Page captured. Anything will open in the background if needed.' : response.error;
  } catch (error) { status.textContent = error.message; }
});
