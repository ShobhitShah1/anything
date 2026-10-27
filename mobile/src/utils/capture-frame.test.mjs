import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureFrame } from './capture-frame.ts';

test('keyboard frames use numeric transforms and keep the expanded top edge fixed', () => {
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const frame = captureFrame(820, -340 * progress, 24, progress, true, 0);
    for (const value of Object.values(frame)) {
      assert.equal(typeof value, 'number');
      assert.ok(Number.isFinite(value));
    }
    assert.equal(900 + frame.translateY - frame.height, 80);
  }
  assert.equal(captureFrame(820, -340, 24, 1, true, 0).paddingBottom, 0);
});

test('collapsed bar keeps its height and an interrupted expansion never becomes negative', () => {
  assert.deepEqual(captureFrame(82, -340, 24, 1, false, 0), {
    height: 82,
    paddingBottom: 0,
    translateY: -340,
  });
  assert.equal(captureFrame(82, -340, 24, 1, true, 0).height, 58);
  assert.equal(captureFrame(82, 0, 24, 0, false, 112).translateY, 112);
});

test('expansion reveals a full-size editor without resizing its contents on each reveal frame', () => {
  for (const keyboardProgress of [0, 0.25, 0.5, 0.75, 1]) {
    const keyboardHeight = -340 * keyboardProgress;
    const content = captureFrame(820, keyboardHeight, 24, keyboardProgress, true, 0);
    for (const revealProgress of [0, 0.25, 0.5, 0.75, 1]) {
      const reveal = captureFrame(
        82 + 738 * revealProgress,
        keyboardHeight,
        24,
        keyboardProgress,
        true,
        0,
      );
      assert.ok(content.height >= reveal.height);
      assert.equal(900 + reveal.translateY - content.height, 80);
    }
  }
});
