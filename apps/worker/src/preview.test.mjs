import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPreview, handlePreview, isPublicPreviewUrl } from './preview.ts';

test('preview fetch only accepts safe public web URLs', () => {
  for (const url of ['https://example.com/article', 'http://example.org'])
    assert.equal(isPublicPreviewUrl(url), true);
  for (const url of [
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'http://localhost/private',
    'http://127.0.0.1/admin',
    'http://192.168.1.1/',
    'https://example.com:8080/',
    'https://service.internal/',
  ])
    assert.equal(isPublicPreviewUrl(url), false, url);
});

test('preview metadata requires an authenticated account', async (t) => {
  let fetched = false;
  t.mock.method(globalThis, 'fetch', async () => {
    fetched = true;
    return new Response('');
  });
  const response = await handlePreview(
    new Request('https://worker.example/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    }),
    {
      FIREBASE_PROJECT_ID: 'test',
      FIREBASE_API_KEY: 'test',
      FIREBASE_SERVICE_ACCOUNT: 'test',
    },
  );
  assert.equal(response.status, 401);
  assert.equal(fetched, false);
});

test('preview extracts social metadata and resolves image and favicon URLs', async (t) => {
  class TestHtmlRewriter {
    handlers = [];
    on(selector, handler) {
      this.handlers.push([selector, handler]);
      return this;
    }
    transform(response) {
      const handlers = this.handlers;
      return {
        async text() {
          const html = await response.text();
          const attrs = (tag) =>
            Object.fromEntries(
              [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [
                match[1].toLowerCase(),
                match[3],
              ]),
            );
          for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
            const value = attrs(tag);
            handlers
              .find(([selector]) => selector === 'meta')?.[1]
              .element({
                getAttribute: (key) => value[key] ?? null,
              });
          }
          for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
            const value = attrs(tag);
            handlers
              .find(([selector]) => selector === 'link')?.[1]
              .element({
                getAttribute: (key) => value[key] ?? null,
              });
          }
          const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1];
          if (title) handlers.find(([selector]) => selector === 'title')?.[1].text({ text: title });
          return '';
        },
      };
    }
  }
  const original = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = TestHtmlRewriter;
  t.after(() => {
    if (original === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = original;
  });

  const preview = await extractPreview(
    '<title>Fallback title</title><meta property="og:title" content="A rich preview"><meta name="description" content="Article details"><meta property="og:image" content="/cover.jpg"><meta property="og:site_name" content="Example"><meta name="author" content="Ada"><link rel="icon" href="/favicon.png">',
    'https://example.com/story',
  );

  assert.equal(preview.title, 'A rich preview');
  assert.equal(preview.description, 'Article details');
  assert.equal(preview.imageUrl, 'https://example.com/cover.jpg');
  assert.equal(preview.favicon, 'https://example.com/favicon.png');
  assert.equal(preview.publisher, 'Example');
  assert.equal(preview.author, 'Ada');
  assert.equal(preview.domain, 'example.com');

  const structured = await extractPreview(
    '<title>Fallback title</title><script type="application/ld+json">{"@type":"Article","headline":"Structured title","description":"Structured details","image":{"url":"/structured.jpg"},"author":{"name":"Grace"},"publisher":{"name":"Journal"}}</script>',
    'https://example.com/structured',
  );
  assert.equal(structured.title, 'Structured title');
  assert.equal(structured.description, 'Structured details');
  assert.equal(structured.imageUrl, 'https://example.com/structured.jpg');
  assert.equal(structured.author, 'Grace');
  assert.equal(structured.publisher, 'Journal');
});
