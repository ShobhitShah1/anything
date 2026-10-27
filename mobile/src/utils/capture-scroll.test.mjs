import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureScroll } from './capture-scroll.ts';

test('capture hides on downward travel and returns on a deliberate upward scroll', () => {
  let state = { offset: 0, travel: 0, hidden: false };
  for (const y of [4, 8, 16, 100]) state = captureScroll(state, y, 500);
  assert.equal(state.hidden, true);
  state = captureScroll(state, 97, 500);
  assert.equal(state.hidden, true);
  state = captureScroll(state, 88, 500);
  assert.equal(state.hidden, false);
});

test('small direction changes do not flicker and the top always reveals capture', () => {
  let state = { offset: 100, travel: 12, hidden: true };
  for (const y of [99, 101, 98, 100]) state = captureScroll(state, y, 500);
  assert.equal(state.hidden, true);
  assert.equal(captureScroll(state, 0, 500).hidden, false);
});

test('overscroll and short content cannot trigger a false direction reversal', () => {
  let state = { offset: 490, travel: 12, hidden: true };
  for (const y of [520, 540, 515, 500]) state = captureScroll(state, y, 500);
  assert.equal(state.hidden, true);
  assert.equal(captureScroll(state, 488, 500).hidden, false);
  assert.deepEqual(captureScroll({ offset: 0, travel: 0, hidden: false }, -40, -10), {
    offset: 0,
    travel: 0,
    hidden: false,
  });
});
