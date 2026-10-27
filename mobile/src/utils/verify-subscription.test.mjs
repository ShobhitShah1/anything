import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifySubscription } from './verify-subscription.ts';

test('confirmed server access returns immediately without retrying checkout', async () => {
  let calls = 0;
  const result = await verifySubscription(async () => {
    calls++;
    return { paid: true };
  }, new AbortController().signal);
  assert.equal(result.paid, true);
  assert.equal(calls, 1);
});

test('verification tolerates delayed server access and stops once confirmed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const result = verifySubscription(
    async () => ({ paid: ++calls === 3 }),
    new AbortController().signal,
  );
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  t.mock.timers.tick(1000);
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  t.mock.timers.tick(2000);
  assert.equal((await result).paid, true);
  assert.equal(calls, 3);
});

test('leaving the screen cancels waiting verification without another request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  let calls = 0;
  const result = verifySubscription(async () => {
    calls++;
    return { paid: false };
  }, controller.signal);
  const stopped = assert.rejects(result, /verification stopped/);
  await new Promise(setImmediate);
  controller.abort();
  await stopped;
  t.mock.timers.tick(15000);
  assert.equal(calls, 1);
});

test('unconfirmed access remains unpaid after the bounded retry window', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const result = verifySubscription(async () => {
    calls++;
    return { paid: false };
  }, new AbortController().signal);
  for (const delay of [1000, 2000, 4000]) {
    await new Promise(setImmediate);
    t.mock.timers.tick(delay);
  }
  assert.equal((await result).paid, false);
  assert.equal(calls, 4);
});

test('verification has a deadline even if token refresh or the network ignores cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = verifySubscription(() => new Promise(() => {}), new AbortController().signal);
  const stopped = assert.rejects(result, /verification stopped/);
  t.mock.timers.tick(15000);
  await stopped;
});
