import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeLink } from './native-data.ts';
test('external navigation accepts web links and rejects local/script schemes', () => {
  assert.equal(safeLink('https://example.com/a'), 'https://example.com/a');
  for (const url of [
    'javascript:alert(1)',
    'file:///secret',
    'data:text/html,test',
    'anything://capture',
  ])
    assert.throws(() => safeLink(url));
});
