import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

test('the image cache never intercepts metadata API requests or removes unrelated caches', async () => {
  const handlers = {};
  const deleted = [];
  const context = {
    self: { addEventListener: (name, handler) => { handlers[name] = handler; }, clients: { claim() {} } },
    caches: { keys: async () => ['anything-image-cache-v1', 'anything-image-cache-v2', 'another-app-cache'], delete: async key => deleted.push(key) },
  };
  runInNewContext(await readFile(new URL('./sw.js', import.meta.url), 'utf8'), context);
  let intercepted = false;
  handlers.fetch({ request: { method: 'GET', destination: '', url: 'https://api.microlink.io/?url=https://instagram.com/p/test' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
  let activation;
  handlers.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['anything-image-cache-v1']);
});
