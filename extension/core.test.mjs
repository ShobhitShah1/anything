import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAppUrl, isAppPage, appendCapture } from './core.mjs';

test('extension targets only the configured collection and rejects unsafe destinations', () => {
  assert.equal(normalizeAppUrl('https://example.com/anything?x=1#old'), 'https://example.com/anything/');
  assert.equal(isAppPage('https://example.com/anything/#saved', 'https://example.com/anything/'), true);
  assert.equal(isAppPage('https://example.com/another/', 'https://example.com/anything/'), false);
  assert.equal(isAppPage('https://evil.example/anything/', 'https://example.com/anything/'), false);
  assert.throws(() => normalizeAppUrl('javascript:alert(1)'));
  assert.throws(() => normalizeAppUrl('https://user:password@example.com/'));
});

test('captures remain queued, deduplicate pending text and never silently evict unsaved data', () => {
  const queue = appendCapture([], ' https://example.com/A ');
  assert.equal(queue[0].text, 'https://example.com/A');
  assert.equal(appendCapture(queue, 'https://example.com/A'), queue);
  assert.equal(appendCapture(queue, 'https://example.com/a').length, 2);
  assert.throws(() => appendCapture([], ''));
  assert.throws(() => appendCapture([], 'a'.repeat(50_001)));
  assert.throws(() => appendCapture(Array.from({ length: 100 }, (_, id) => ({ id: String(id), text: String(id) })), 'new capture'));
});
