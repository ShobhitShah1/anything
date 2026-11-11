import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLinkPreview } from '../shared/utils/fetchPreview.ts';
import { getItemTitle } from '../shared/utils/itemTitle.ts';
import { parseSocialUrl } from '../shared/utils/storage.ts';

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

test('Reddit posts use Reddit oEmbed metadata before the generic preview service', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      title: 'A public Reddit post',
      author_name: 'example_user',
      thumbnail_url: 'https://i.redd.it/post.jpg',
    }),
  }));
  const preview = await fetchLinkPreview(
    'https://www.reddit.com/r/example/comments/abc123/a_public_post/',
  );

  assert.equal(preview.title, 'A public Reddit post');
  assert.equal(preview.author, 'example_user');
  assert.equal(preview.imageUrl, 'https://i.redd.it/post.jpg');
  assert.equal(fetch.mock.callCount(), 1);
  assert.match(String(fetch.mock.calls[0].arguments[0]), /^https:\/\/www\.reddit\.com\/oembed\?/);
  t.mock.restoreAll();
});

test('Reddit metadata falls back to Microlink when Reddit oEmbed is unavailable', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) =>
    String(url).startsWith('https://www.reddit.com/oembed')
      ? { ok: false, status: 403 }
      : {
          ok: true,
          json: async () => ({ status: 'success', data: { title: 'Microlink fallback' } }),
        },
  );
  const preview = await fetchLinkPreview(
    'https://reddit.com/r/example/comments/xyz789/another_post',
  );

  assert.equal(preview.title, 'Microlink fallback');
  assert.equal(fetch.mock.callCount(), 2);
  t.mock.restoreAll();
});

test('Reddit post URLs provide a readable title when both metadata services fail', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 403 }));

  const preview = await fetchLinkPreview(
    'https://reddit.com/r/example/comments/fallback1/a_readable_post_title/',
  );

  assert.equal(preview.title, 'A readable post title');
  assert.equal(preview.publisher, 'Reddit');
  assert.equal(preview.error, 'This page could not be previewed.');
  t.mock.restoreAll();
});

test('Reddit details keep a readable title and only treat actual posts as Reddit posts', () => {
  assert.equal(
    getItemTitle({
      id: 'reddit',
      type: 'reddit_post',
      title: 'Reddit',
      postUrl: 'https://www.reddit.com/r/example/comments/abc123/a_readable_post/',
      subreddit: 'r/example',
      author: '',
      content: '',
      createdAt: 1,
      isPinned: false,
      tags: [],
    }),
    'A readable post',
  );
  assert.equal(
    parseSocialUrl('https://www.reddit.com/r/example/comments/abc123/a_readable_post/')
      .detectedType,
    'reddit_post',
  );
  assert.equal(parseSocialUrl('https://www.reddit.com/r/example/').detectedType, 'link');
});
