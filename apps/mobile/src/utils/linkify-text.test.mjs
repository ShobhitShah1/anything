import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkifyText } from './linkify-text.ts';

test('linkifies full URLs, www links, and bare domains while preserving punctuation', () => {
  assert.deepEqual(
    linkifyText('Read https://example.com/path?x=1, then (www.example.org) or example.net.'),
    [
      { text: 'Read ' },
      { text: 'https://example.com/path?x=1', href: 'https://example.com/path?x=1' },
      { text: ', then (' },
      { text: 'www.example.org', href: 'https://www.example.org/' },
      { text: ') or ' },
      { text: 'example.net', href: 'https://example.net/' },
      { text: '.' },
    ],
  );
});

test('does not turn email addresses or non-web schemes into links', () => {
  assert.deepEqual(linkifyText('Mail name@example.com or javascript:alert(1).'), [
    { text: 'Mail name@example.com or javascript:alert(1).' },
  ]);
});
