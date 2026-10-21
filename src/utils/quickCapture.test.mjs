import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuickCaptures, extractLinks } from './quickCapture.ts';
import { findDuplicateItem, readClipboardSafely } from './clipboard.ts';
import { applyLinkPreview } from './fetchPreview.ts';

test('batch capture extracts complete URLs, removes prose punctuation and rejects unsafe schemes', () => {
  assert.deepEqual(extractLinks('Read (https://example.com/A?x=1&y=2), then https://example.org/b.\nhttps://example.com/A?x=1&y=2'), ['https://example.com/A?x=1&y=2', 'https://example.org/b']);
  assert.deepEqual(extractLinks('https://en.wikipedia.org/wiki/Foo_(bar)'), ['https://en.wikipedia.org/wiki/Foo_(bar)']);
  assert.deepEqual(extractLinks('example.com/design'), ['https://example.com/design']);
  assert.deepEqual(extractLinks('example.com/design\nexample.org/ideas'), ['https://example.com/design', 'https://example.org/ideas']);
  assert.deepEqual(extractLinks('http://localhost:3000/design'), ['http://localhost:3000/design']);
  assert.deepEqual(extractLinks('javascript:alert(1) https://user:password@example.com'), []);
  assert.throws(() => createQuickCaptures('not a link', [], true));
  assert.throws(() => createQuickCaptures('x'.repeat(50_001), []));
});

test('quick capture creates real item types without invented social counts and skips duplicates', () => {
  const first = createQuickCaptures('https://example.com/A\nhttps://x.com/ada/status/123\nhttps://example.com/photo.png', []);
  assert.deepEqual(first.items.map(item => item.type), ['link', 'x_post', 'image']);
  assert.equal(first.items[1].likes, undefined);
  assert.equal(new Set(first.items.map(item => item.id)).size, 3);
  assert.equal(createQuickCaptures('https://example.com/A', first.items).duplicates, 1);
  assert.equal(createQuickCaptures('https://example.com/a', first.items).items.length, 1);
  const note = createQuickCaptures('Hello', [], false, 'ideas').items[0];
  assert.equal(note.folderId, 'ideas');
  assert.equal(createQuickCaptures('Hello', [note]).duplicates, 1);
  assert.equal(createQuickCaptures('hello', [note]).items.length, 1);
  assert.equal(createQuickCaptures('# Notes\nA thought', []).items[0].type, 'markdown');
  assert.equal(createQuickCaptures('const answer = 42;', []).items[0].type, 'code');
  const prose = 'Compare https://example.com and https://example.org before choosing.';
  assert.equal(createQuickCaptures(prose, []).items[0].content, prose);
  assert.equal(createQuickCaptures(prose, [], true).items.length, 2);
  assert.equal(findDuplicateItem('example.com/A', first.items)?.type, 'link');
});

test('new social captures receive metadata and preserve writing', () => {
  const [reddit, instagram] = createQuickCaptures('https://reddit.com/r/design/comments/abc\nhttps://instagram.com/p/example/', []).items;
  const preview = { url: reddit.postUrl, domain: 'reddit.com', title: 'A useful discussion', description: 'A real caption', imageUrl: 'https://example.com/cover.png', author: 'Ada', authorHandle: 'ada' };
  assert.equal(applyLinkPreview(reddit, preview).title, 'A useful discussion');
  assert.equal(applyLinkPreview(instagram, preview).imageUrl, preview.imageUrl);
  assert.equal(applyLinkPreview({ ...instagram, caption: 'My note' }, preview).caption, 'My note');
});

test('clipboard batches use actual copied text and permission failures remain recoverable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { readText: async () => 'https://example.com/a\nhttps://example.org/b' } } });
    const result = await readClipboardSafely();
    assert.equal(result.status, 'ok');
    assert.equal(createQuickCaptures(result.text, [], true).items.length, 2);
    globalThis.navigator.clipboard.readText = async () => { throw new Error('Not allowed'); };
    assert.equal((await readClipboardSafely()).status, 'permission_denied');
    globalThis.navigator.clipboard = undefined;
    assert.equal((await readClipboardSafely()).status, 'unsupported');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});
