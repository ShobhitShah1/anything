import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardWidths } from './card-widths.ts';

test('list text gets its destination width before recycled grid cells catch up', () => {
  assert.deepEqual(cardWidths(192, false, true), { width: 180, contentWidth: 180 });
  assert.deepEqual(cardWidths(384, true, true), { width: 372, contentWidth: 252 });
  // The image panel, gap, body, and its right inset must fit the row exactly.
  assert.equal(104 + 16 + cardWidths(384, true, true).contentWidth, 372);
  assert.deepEqual(cardWidths(384, true, false), { width: 372, contentWidth: 340 });
});

test('narrow windows never produce a negative native text width', () => {
  assert.deepEqual(cardWidths(10, true, true), { width: 0, contentWidth: 0 });
  assert.deepEqual(cardWidths(120, true, true), { width: 108, contentWidth: 0 });
});
