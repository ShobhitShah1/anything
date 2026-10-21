export const DEFAULT_APP_URL = 'http://localhost:5173/';

export function normalizeAppUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http or https Anything address without credentials.');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) url.pathname += '/';
  return url.href;
}

export function isAppPage(pageUrl, appUrl) {
  try {
    const page = new URL(pageUrl);
    const app = new URL(normalizeAppUrl(appUrl));
    return page.origin === app.origin && page.pathname === app.pathname;
  } catch { return false; }
}

export function appendCapture(queue, text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 50_000) throw new Error('Save between 1 and 50,000 characters at a time.');
  if (queue.some(entry => entry.text === text.trim())) return queue;
  if (queue.length >= 100) throw new Error('100 captures are waiting. Open Anything to finish saving them first.');
  return [...queue, { id: crypto.randomUUID(), text: text.trim() }];
}
