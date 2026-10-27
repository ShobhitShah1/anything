import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleSelection, toggleVisibleSelection } from './selection.ts';

test('card selection toggles without mutating or duplicating IDs', () => {
  const selected = ['a'];
  assert.deepEqual(toggleSelection(selected, 'b'), ['a', 'b']);
  assert.deepEqual(toggleSelection(selected, 'a'), []);
  assert.deepEqual(selected, ['a']);
});

test('select all affects only visible cards and preserves selections outside the current filter', () => {
  assert.deepEqual(toggleVisibleSelection(['hidden', 'a'], ['a', 'b']), ['hidden', 'a', 'b']);
  assert.deepEqual(toggleVisibleSelection(['hidden', 'a', 'b'], ['a', 'b']), ['hidden']);
  assert.deepEqual(toggleVisibleSelection(['hidden'], []), ['hidden']);
  assert.deepEqual(toggleVisibleSelection([], ['a', 'a', 'b']), ['a', 'b']);
});
