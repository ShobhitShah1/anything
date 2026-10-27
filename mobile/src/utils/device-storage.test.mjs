import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadText, saveText } from './device-storage.ts';
function memory() {
  const data = new Map();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    multiSet: async (entries) => {
      for (const [key, value] of entries) data.set(key, value);
    },
    multiRemove: async (keys) => {
      for (const key of keys) data.delete(key);
    },
  };
}
test('large images and Unicode survive chunked storage', async () => {
  const storage = memory();
  const text = 'image 🌱'.repeat(100000);
  await saveText(storage, 'collection', text);
  assert.equal(await loadText(storage, 'collection'), text);
  assert.ok([...storage.data.values()].every((value) => value.length <= 128000));
});
test('a failed write leaves the previous collection readable', async () => {
  const storage = memory();
  await saveText(storage, 'collection', 'old data');
  const failing = {
    ...storage,
    multiSet: async () => {
      throw new Error('Disk full');
    },
  };
  await assert.rejects(saveText(failing, 'collection', 'new data'), /Disk full/);
  assert.equal(await loadText(storage, 'collection'), 'old data');
});
test('missing chunks fail instead of silently displaying an empty collection', async () => {
  const storage = memory();
  await saveText(storage, 'collection', 'saved');
  for (const key of storage.data.keys()) if (!key.endsWith(':index')) storage.data.delete(key);
  await assert.rejects(loadText(storage, 'collection'), /missing/);
});
