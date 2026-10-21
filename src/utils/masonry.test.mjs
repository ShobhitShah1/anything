import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packMasonry } from './masonry.ts';

test('masonry balances measured heights without overlap or a trailing gap', () => {
  const heights = [100, 200, 80, 150, 300, 40];
  for (const columns of [1, 2, 3, 4, 6, 8]) {
    const { positions, height } = packMasonry(heights, columns, 24);
    positions.forEach((position, index) => {
      const previous = positions.slice(0, index).findLastIndex(other => other.column === position.column);
      assert.equal(position.top, previous < 0 ? 0 : positions[previous].top + heights[previous] + 24);
    });
    assert.equal(height, Math.max(...positions.map((position, index) => position.top + heights[index])));
  }
  assert.deepEqual(packMasonry([], 3, 24), { positions: [], height: 0 });
});
