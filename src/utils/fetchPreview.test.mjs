import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchLinkPreview, getImmediateLinkPreview, normalizeUrl, isDirectImageUrl, applyLinkPreview } from './fetchPreview.ts';

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


test('X posts fetch real text, author, counts and media rather than caching a placeholder', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return Response.json({ code: 200, tweet: {
      text: 'The real post body', author: { name: 'Ada', screen_name: 'ada', avatar_url: 'https://pbs.twimg.com/avatar.jpg' },
      likes: 12, retweets: 3, media: { photos: [{ url: 'https://pbs.twimg.com/photo.jpg' }] },
    } });
  };
  try {
    const data = await fetchLinkPreview('https://x.com/ada/status/123456789?source=share');
    assert.equal(calls[0], 'https://api.fxtwitter.com/status/123456789');
    assert.equal(data.description, 'The real post body');
    assert.equal(data.authorHandle, '@ada');
    assert.equal(data.likes, 12);
    assert.equal(data.imageUrl, 'https://pbs.twimg.com/photo.jpg');
    assert.equal((await fetchLinkPreview('https://x.com/ada/status/123456789?source=share')).author, 'Ada');
    assert.equal(calls.length, 1);
    const missing = await fetchLinkPreview('https://x.com/ada');
    assert.match(missing.error, /status/);
  } finally { globalThis.fetch = originalFetch; }
});

test('video previews enrich instant thumbnails and API image URLs are sanitized', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return Response.json({ title: 'A video worth keeping', author_name: 'Ada', thumbnail_url: 'javascript:bad' });
  };
  try {
    const data = await fetchLinkPreview('https://youtu.be/aqz-KE-bpKQ');
    assert.match(calls[0], /^https:\/\/noembed.com\/embed\?/);
    assert.equal(data.title, 'A video worth keeping');
    assert.equal(data.author, 'Ada');
    assert.match(data.imageUrl, /^https:\/\/img.youtube.com/);
  } finally { globalThis.fetch = originalFetch; }
});

test('background enrichment fills incomplete saves and preserves personal writing', () => {
  const base = { id: 'a', title: 'example.com', createdAt: 1, isPinned: false, tags: [], type: 'link', url: 'https://example.com/', domain: 'example.com' };
  const preview = { url: base.url, domain: base.domain, title: 'Real title', description: 'Real description', imageUrl: 'https://example.com/cover.jpg' };
  assert.equal(applyLinkPreview(base, preview).title, 'Real title');
  assert.equal(applyLinkPreview({ ...base, title: 'My title', description: 'My note' }, preview).description, 'My note');
  assert.equal(applyLinkPreview({ ...base, title: 'My title' }, preview).title, 'My title');
  const post = { ...base, type: 'x_post', postUrl: 'https://x.com/ada/status/123', content: 'Post on X', authorName: 'ada', authorHandle: '@ada' };
  assert.equal(applyLinkPreview(post, preview).content, 'Real description');
  assert.equal(applyLinkPreview({ ...post, content: 'My own post notes' }, preview).content, 'My own post notes');
  assert.deepEqual(applyLinkPreview(base, { ...preview, error: 'offline' }), base);
});
