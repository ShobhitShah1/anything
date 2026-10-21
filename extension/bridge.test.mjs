import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('delivery bridge accepts only same-page acknowledgements for IDs actually delivered', async () => {
  let deliver;
  let receive;
  let posted;
  let timer;
  let acknowledged;
  const page = { addEventListener: (_name, callback) => { receive = callback; }, removeEventListener() {}, postMessage: message => { posted = message; } };
  const source = await readFile(new URL('./bridge.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    window: page, location: { origin: 'http://localhost:5173' },
    chrome: { runtime: { id: 'test', onMessage: { addListener: callback => { deliver = callback; } }, sendMessage: async () => {} } },
    setTimeout: callback => { timer = callback; return 1; }, clearTimeout() {},
  });
  deliver({ type: 'anything:deliver', entries: [{ id: 'capture-1', text: 'A thought' }] }, { id: 'test' }, value => { acknowledged = value; });
  assert.equal(posted.entries[0].text, 'A thought');
  receive({ source: page, origin: 'https://evil.example', data: { source: 'anything-app', savedIds: ['capture-1'] } });
  assert.equal(acknowledged, undefined);
  receive({ source: page, origin: 'http://localhost:5173', data: { source: 'anything-app', savedIds: ['capture-1', 'not-delivered'] } });
  assert.deepEqual(Array.from(acknowledged.savedIds), ['capture-1']);
  acknowledged = undefined;
  deliver({ type: 'anything:deliver', entries: [{ id: 'capture-2', text: 'Another thought' }] }, { id: 'test' }, value => { acknowledged = value; });
  timer();
  assert.equal(acknowledged.savedIds.length, 0);
});
