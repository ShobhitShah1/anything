import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchLinkPreview, getImmediateLinkPreview, normalizeUrl, isDirectImageUrl } from './fetchPreview.ts';

test('URLs and instant previews are safe and require no request', () => {
  assert.equal(normalizeUrl(' example.com/article '), 'https://example.com/article');
  assert.throws(() => normalizeUrl('javascript:alert(1)'));
  assert.throws(() => normalizeUrl('https://user:pass@example.com'));
  assert.equal(isDirectImageUrl('https://images.unsplash.com.evil.test/photo'), false);
  assert.equal(getImmediateLinkPreview('example.com').domain, 'example.com');
  assert.equal(getImmediateLinkPreview('example.com').imageUrl, undefined);
  assert.match(getImmediateLinkPreview('https://github.com/test/repo').imageUrl, /opengraph.githubassets.com/);
});

test('metadata shares requests, caches results, refreshes and falls back on failure', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ status: 'success', data: {
      title: `Title ${calls}`, description: 'Page summary', image: { url: 'javascript:alert(1)' },
    } });
  };
  try {
    const first = fetchLinkPreview('https://test.example/article');
    const shared = fetchLinkPreview('https://test.example/article');
    assert.equal(first, shared);
    const result = await first;
    assert.equal(calls, 1);
    assert.equal(result.title, 'Title 1');
    assert.equal(result.imageUrl, undefined);
    assert.equal((await fetchLinkPreview('https://test.example/article')).title, 'Title 1');
    assert.equal(calls, 1);
    assert.equal((await fetchLinkPreview('https://test.example/article', true)).title, 'Title 2');
    globalThis.fetch = async () => { throw new Error('offline'); };
    const fallback = await fetchLinkPreview('https://offline.example');
    assert.equal(fallback.domain, 'offline.example');
    assert.equal(fallback.imageUrl, undefined);
    globalThis.fetch = async () => new Response('', { status: 429 });
    const limited = await fetchLinkPreview('https://rate-limited.example');
    assert.match(limited.error, /busy/);
    assert.equal((await fetchLinkPreview('https://youtu.be/dQw4w9WgXcQ')).domain, 'youtube.com');
  } finally { globalThis.fetch = originalFetch; }
});

test('the preview deadline also aborts a response body that stalls', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  });
  const started = Date.now();
  try {
    const fallback = await fetchLinkPreview('https://slow.example');
    assert.equal(fallback.domain, 'slow.example');
    assert.ok(Date.now() - started < 9000);
  } finally { globalThis.fetch = originalFetch; }
});

