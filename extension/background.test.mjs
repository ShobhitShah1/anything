import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { DEFAULT_APP_URL, normalizeAppUrl, isAppPage, appendCapture } from './core.mjs';

async function worker(acknowledge = true) {
  const handlers = {};
  const state = { appUrl: 'http://localhost:5173/', queue: [], copyEnabled: false };
  const deliveries = [];
  const injections = [];
  const listen = name => ({ addListener: handler => { handlers[name] = handler; } });
  const chrome = {
    runtime: { id: 'test', getURL: path => `chrome-extension://test/${path}`, onInstalled: listen('install'), onStartup: listen('startup'), onMessage: listen('message') },
    storage: { local: { get: async () => structuredClone(state), set: async values => Object.assign(state, structuredClone(values)) } },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    permissions: { onRemoved: listen('permissions'), contains: async () => false },
    contextMenus: { onClicked: listen('context'), removeAll: callback => callback(), create: () => {} },
    scripting: { executeScript: async options => injections.push(options.target.tabId), getRegisteredContentScripts: async () => [] },
    tabs: {
      query: async () => [{ id: 9, url: 'https://evil.example/' }, { id: 2, url: state.appUrl, status: 'complete' }],
      onUpdated: listen('tabs'),
      sendMessage: async (tabId, message) => { deliveries.push({ tabId, message }); return { savedIds: acknowledge ? [...message.entries.map(entry => entry.id), 'not-in-batch'] : [] }; },
    },
  };
  const source = (await readFile(new URL('./background.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
  runInNewContext(source, { chrome, DEFAULT_APP_URL, normalizeAppUrl, isAppPage, appendCapture, crypto, URL });
  const send = (message, sender = { id: 'test', url: chrome.runtime.getURL('popup.html') }) => new Promise(resolve => handlers.message(message, sender, resolve));
  return { state, deliveries, injections, send };
}

test('extension delivers only to the configured app and removes only acknowledged captures', async () => {
  const app = await worker();
  assert.equal((await app.send({ type: 'anything:capture', text: 'https://example.com/' })).ok, true);
  await new Promise(setImmediate);
  assert.deepEqual(app.injections, [2]);
  assert.equal(app.deliveries[0].tabId, 2);
  assert.equal(app.deliveries[0].message.entries[0].text, 'https://example.com/');
  assert.equal(app.state.queue.length, 0);
  const waiting = await worker(false);
  await waiting.send({ type: 'anything:capture', text: 'A saved thought' });
  await new Promise(setImmediate);
  assert.equal(waiting.state.queue.length, 1);
});

test('website copy capture is opt-in and copying from Anything never creates a capture loop', async () => {
  const app = await worker();
  const sender = { id: 'test', tab: { url: 'https://example.com/' } };
  assert.equal((await app.send({ type: 'anything:copied', text: 'Hello' }, sender)).ok, false);
  assert.equal(app.state.queue.length, 0);
  app.state.copyEnabled = true;
  assert.equal((await app.send({ type: 'anything:copied', text: 'Hello' }, { id: 'test', tab: { url: app.state.appUrl } })).ok, true);
  assert.equal(app.deliveries.length, 0);
  assert.equal((await app.send({ type: 'anything:copied', text: 'Hello' }, sender)).ok, true);
  await new Promise(setImmediate);
  assert.equal(app.deliveries.length, 1);
});

test('copy listener ignores password fields and synthetic events', async () => {
  let copied;
  const sent = [];
  let password = true;
  const context = {
    window: { getSelection: () => ({ toString: () => 'selected text' }) },
    document: { activeElement: { matches: () => password }, addEventListener: (_name, callback) => { copied = callback; } },
    chrome: { storage: { local: { get: async () => ({ copyEnabled: true }) }, onChanged: { addListener() {} } }, runtime: { sendMessage: async message => sent.push(message) } },
    navigator: { clipboard: { readText: async () => 'Actual copied text' } },
    setTimeout: callback => callback(),
  };
  runInNewContext(await readFile(new URL('./copy.js', import.meta.url), 'utf8'), context);
  await new Promise(setImmediate);
  copied({ isTrusted: true });
  password = false;
  copied({ isTrusted: false });
  assert.equal(sent.length, 0);
  copied({ isTrusted: true });
  await new Promise(setImmediate);
  assert.equal(sent[0].text, 'Actual copied text');
  context.navigator.clipboard = undefined;
  copied({ isTrusted: true });
  await new Promise(setImmediate);
  assert.equal(sent[1].text, 'selected text');
});
