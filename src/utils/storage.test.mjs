import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFolders, loadSavedItems, parseSocialUrl, saveItemsToStorage } from './storage.ts';

test('social preview routing uses the hostname, not text inside paths or queries', () => {
  assert.equal(parseSocialUrl('https://x.com/ada/status/123').detectedType, 'x_post');
  assert.equal(parseSocialUrl('https://mobile.twitter.com/ada/status/123').detectedType, 'x_post');
  assert.equal(parseSocialUrl('https://x.com.evil.example/ada/status/123').detectedType, 'link');
  assert.equal(parseSocialUrl('https://example.com/?url=https://x.com/ada/status/123').detectedType, 'link');
  assert.equal(parseSocialUrl('https://www.reddit.com/r/design/comments/abc').detectedType, 'reddit_post');
});

test('capture persistence reports success and quota failure so the extension can retain unsaved data', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalError = console.error;
  try {
    let stored;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: (_key, value) => { stored = value; } } });
    assert.equal(saveItemsToStorage([{ id: 'one' }]), true);
    assert.equal(JSON.parse(stored)[0].id, 'one');
    globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
    console.error = () => {};
    assert.equal(saveItemsToStorage([{ id: 'two' }]), false);
  } finally {
    console.error = originalError;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('deleting every save persists an empty collection without restoring legacy saves or removing folders', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const stored = new Map([
    ['anything_items_v2', JSON.stringify([{ id: 'current', isPinned: true }])],
    ['anything_vault_items_v2', JSON.stringify([{ id: 'legacy' }])],
    ['anything_folders_v1', JSON.stringify([{ id: 'folder' }])],
  ]);
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    } });
    assert.equal(saveItemsToStorage([]), true);
    assert.deepEqual(loadSavedItems(), []);
    assert.deepEqual(JSON.parse(stored.get('anything_folders_v1')), [{ id: 'folder' }]);
    stored.set('anything_folders_v1', '[]');
    assert.deepEqual(loadFolders(), []);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
