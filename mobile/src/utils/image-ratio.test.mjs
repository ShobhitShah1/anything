import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageRatio } from './image-ratio.ts';

test('image dimensions retain portrait, landscape and panorama proportions', () => {
  assert.equal(imageRatio(800, 1200), 2 / 3);
  assert.equal(imageRatio(1600, 900), 16 / 9);
  assert.equal(imageRatio(4000, 500), 8);
  for (const [width, height] of [
    [0, 100],
    [100, 0],
    [-1, 100],
    [Infinity, 1],
    [1, Infinity],
    [NaN, 1],
  ]) {
    assert.equal(imageRatio(width, height), undefined);
  }
});
