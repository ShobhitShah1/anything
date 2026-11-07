import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedFreeAccount } from './ad-eligibility.ts';

test('ads require both the server and store to confirm the account is free', () => {
  assert.equal(confirmedFreeAccount(false, false), true);
  assert.equal(confirmedFreeAccount(true, false), false);
  assert.equal(confirmedFreeAccount(false, true), false);
  assert.equal(confirmedFreeAccount(false, undefined), false);
  assert.equal(confirmedFreeAccount(undefined, false), false);
});
