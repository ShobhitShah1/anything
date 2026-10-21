import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="theme-init">([\s\S]*?)<\/script>/)[1];

test('the saved theme is applied before CSS and React, without a hard-coded dark shell', () => {
  for (const [saved, systemDark, expected] of [['light', true, 'light'], ['dark', false, 'dark'], [null, true, 'dark'], [null, false, 'light']]) {
    const classes = [];
    runInNewContext(script, {
      localStorage: { getItem: () => saved },
      matchMedia: () => ({ matches: systemDark }),
      document: { documentElement: { classList: { add: value => classes.push(value) } } },
    });
    assert.deepEqual(classes, [expected]);
  }
  const classes = [];
  runInNewContext(script, {
    localStorage: { getItem: () => { throw new Error('Storage unavailable'); } },
    document: { documentElement: { classList: { add: value => classes.push(value) } } },
  });
  assert.deepEqual(classes, ['light']);
  assert.ok(html.indexOf('id="theme-init"') < html.indexOf('rel="stylesheet"'));
  assert.doesNotMatch(html, /<html[^>]+class="dark"|<body[^>]+bg-\[#09090B\]/);
  assert.match(html, /display=optional/);
});
