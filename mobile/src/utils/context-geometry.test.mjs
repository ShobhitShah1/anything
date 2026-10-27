import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextGeometry } from './context-geometry.ts';

test('context preview and menu fit phones for grid, list, tall and scrolled cards', () => {
  for (const [width, height] of [
    [320, 640],
    [412, 915],
    [915, 412],
  ]) {
    for (const source of [
      { x: 18, y: 200, width: 170, height: 350 },
      { x: 18, y: -100, width: width - 36, height: 124 },
      { x: 18, y: 500, width: width - 36, height: 1200 },
    ]) {
      const target = contextGeometry(source, width, height, 24, 24);
      assert.ok(target.x >= 24 - 1e-8);
      assert.ok(target.x + source.width * target.scale <= width - 24 + 1e-8);
      assert.ok(target.y >= 24);
      assert.ok(target.menuY + target.menuHeight <= height - 24);
      assert.ok(target.scale > 0);
      assert.equal(source.y, source.height === 350 ? 200 : source.height === 124 ? -100 : 500);
    }
  }
});

test('all seven context actions fit without the old 48-percent scrolling cap', () => {
  const desired = 46 + 7 * 49;
  const source = { x: 18, y: 200, width: 170, height: 350 };
  for (const [width, height] of [
    [320, 640],
    [412, 915],
  ]) {
    const target = contextGeometry(source, width, height, 24, 24, desired);
    assert.equal(target.menuHeight, desired);
    assert.ok(target.menuY + target.menuHeight <= height - 24);
  }
  const landscape = contextGeometry(source, 915, 412, 24, 24, desired);
  assert.ok(landscape.menuHeight < desired);
  assert.ok(landscape.menuY + landscape.menuHeight <= 412 - 24);
});
