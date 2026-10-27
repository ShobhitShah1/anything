import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLinkPreview } from '../shared/utils/fetchPreview.ts';

test('native previews share requests, cache metadata, and refresh without browser APIs', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      status: 'success',
      data: { title: 'A useful find', image: { url: 'https://images.example.com/photo.jpg' } },
    }),
  }));
  const url = 'https://preview-cache.example.com/article';
  const first = fetchLinkPreview(url);
  assert.equal(fetchLinkPreview(url), first);
  const preview = await first;
  assert.equal(preview.title, 'A useful find');
  assert.equal(preview.imageUrl, 'https://images.example.com/photo.jpg');
  assert.equal(await fetchLinkPreview(url), preview);
  assert.equal(fetch.mock.callCount(), 1);
  await fetchLinkPreview(url, true);
  assert.equal(fetch.mock.callCount(), 2);
  t.mock.restoreAll();
});

test('native previews retain useful errors and reject unsafe metadata images', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429 }));
  const failed = await fetchLinkPreview('https://preview-error.example.com/article');
  assert.match(failed.error, /busy/);
  assert.equal(failed.url, 'https://preview-error.example.com/article');
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ status: 'success', data: { image: { url: 'file:///private.jpg' } } }),
  }));
  const preview = await fetchLinkPreview('https://preview-image.example.com/article');
  assert.equal(preview.imageUrl, undefined);
  t.mock.restoreAll();
});
