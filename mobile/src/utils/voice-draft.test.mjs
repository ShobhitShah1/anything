import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyVoiceResult, shouldCancelForBackground, voiceEndMessage } from './voice-draft.ts';

test('dictation replaces partial hypotheses and appends finalized segments once', () => {
  let draft = { prefix: 'My draft', committed: '', text: 'My draft' };
  for (const [phrase, final, expected] of [
    ['I scream', false, 'I scream'],
    ['Ice cream', false, 'Ice cream'],
    ['Ice cream.', true, 'Ice cream.'],
    ['Is', false, 'Ice cream. Is'],
    ['Is nice.', true, 'Ice cream. Is nice.'],
  ]) {
    draft = applyVoiceResult(draft, phrase, final);
    assert.equal(draft.text, 'My draft\n' + expected);
  }
  assert.deepEqual(applyVoiceResult(draft, '', true), draft);
});

test('dictation preserves original whitespace and handles an empty draft', () => {
  for (const prefix of ['', '  a  ', 'a\n']) {
    const draft = applyVoiceResult({ prefix, committed: '', text: prefix }, 'Hello', false);
    assert.equal(draft.text, prefix + (prefix && !prefix.endsWith('\n') ? '\n' : '') + 'Hello');
  }
});

test('unexpected native ends are visible while normal finishes, cancellations and errors do not add a second error', () => {
  assert.match(voiceEndMessage(false, 0, ''), /before the microphone was ready/);
  assert.match(voiceEndMessage(true, 0, ''), /ended without text/);
  assert.equal(voiceEndMessage(true, 3, ''), '');
  for (const reason of ['finished', 'user', 'background', 'capture-closed', 'error:no-speech'])
    assert.equal(voiceEndMessage(true, 0, reason), '');
});

test('the permission activity background/active sequence does not abort a granted mic request', () => {
  const controller = new AbortController();
  let permissionPending = true;
  const recognizing = false;
  if (shouldCancelForBackground(permissionPending, recognizing)) controller.abort();
  permissionPending = false;
  assert.equal(controller.signal.aborted, false);
  assert.equal(shouldCancelForBackground(permissionPending, true), true);
});

test('real backgrounding still cancels capture, generation, and an active microphone', () => {
  assert.equal(shouldCancelForBackground(false, false), true);
  assert.equal(shouldCancelForBackground(false, true), true);
  assert.equal(shouldCancelForBackground(true, true), true);
});
