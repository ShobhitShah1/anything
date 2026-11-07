import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containedMedia, crossesViewport } from './motion-geometry.ts';

test('animate cards on screen, entering, leaving, or crossing the viewport', () => {
  assert.equal(crossesViewport(100, 200, 300, 200, 800), true);
  assert.equal(crossesViewport(900, 200, 500, 200, 800), true);
  assert.equal(crossesViewport(500, 200, 900, 200, 800), true);
  assert.equal(crossesViewport(-300, 200, 900, 200, 800), true);
  assert.equal(crossesViewport(900, 200, 1200, 200, 800), false);
  assert.equal(crossesViewport(-500, 200, -300, 200, 800), false);
});

test('grid, list, and expanded media preserve the complete image and the same proportions', () => {
  for (const ratio of [9 / 16, 1, 16 / 9, 4]) {
    for (const [width, height] of [
      [180, 180 / ratio],
      [76, 92],
      [104, 124],
      [104, 186],
      [375, 375 / ratio],
    ]) {
      const rect = containedMedia(width, height, ratio);
      assert.ok(Math.abs(rect.width / rect.height - ratio) < 1e-8);
      assert.ok(rect.x >= 0 && rect.y >= 0);
      assert.ok(rect.x + rect.width <= width + 1e-8);
      assert.ok(rect.y + rect.height <= height + 1e-8);
    }
  }
});

test('unmeasured or invalid media never produces a non-finite transform', () => {
  for (const values of [
    [0, 92, 1],
    [76, 0, 1],
    [76, 92, 0],
    [76, 92, NaN],
  ])
    assert.deepEqual(containedMedia(...values), { x: 0, y: 0, width: 0, height: 0 });
});
