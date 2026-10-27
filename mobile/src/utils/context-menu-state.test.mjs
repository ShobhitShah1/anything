import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextMenuPhase } from './context-menu-state.ts';

test('cached image readiness cannot reopen a closing preview across repeated cycles', () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    let phase = 'loading';
    phase = contextMenuPhase(phase, 'ready');
    assert.equal(phase, 'open');
    phase = contextMenuPhase(phase, 'close');
    phase = contextMenuPhase(phase, 'ready');
    assert.equal(phase, 'closing');
    phase = contextMenuPhase(phase, 'finished');
    assert.equal(phase, 'finished');
    assert.equal(contextMenuPhase(phase, 'ready'), 'finished');
    assert.equal(contextMenuPhase(phase, 'close'), 'finished');
  }
});

test('closing before image readiness also completes without a late opening animation', () => {
  assert.equal(contextMenuPhase('loading', 'finished'), 'loading');
  const closing = contextMenuPhase('loading', 'close');
  assert.equal(contextMenuPhase(closing, 'ready'), 'closing');
  assert.equal(contextMenuPhase(closing, 'finished'), 'finished');
});
