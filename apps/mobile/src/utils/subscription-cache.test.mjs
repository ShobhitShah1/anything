import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { subscriptionPlans } from './subscription-plans.ts';

const source = ts.transpileModule(
  readFileSync(new URL('../services/subscription.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function setup() {
  const auth = { currentUser: { uid: 'one' } };
  const exports = {};
  const requests = [];
  const product = {
    identifier: '$rc_monthly',
    product: { identifier: 'anything_pro:monthly', subscriptionPeriod: 'P1M', priceString: '₹99' },
  };
  runInNewContext(source, {
    exports,
    AbortController,
    require(name) {
      if (name === './auth') return { auth };
      if (name === './ai')
        return {
          getAiAccess: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
        };
      if (name === './billing')
        return {
          billingClient: async () => ({
            getOfferings: async () => ({ current: { availablePackages: [product] } }),
            getCustomerInfo: async () => ({ entitlements: { active: {} } }),
          }),
        };
      if (name === '../utils/billing-config') return { hasPro: () => false };
      if (name === '../utils/subscription-plans') return { subscriptionPlans };
      throw new Error(name);
    },
  });
  return { ...exports, auth, requests, product };
}

test('startup prefetch and opening membership share a request and retain ready plans', async () => {
  const cache = setup();
  const startup = cache.loadSubscription('one');
  assert.equal(cache.loadSubscription('one'), startup);
  assert.equal(cache.requests.length, 1);
  cache.requests[0].resolve({ paid: false, remaining: 3 });
  await startup;
  assert.equal(cache.subscriptionSnapshot('one').plans[0], cache.product);
  assert.equal(cache.subscriptionSnapshot('one').access.remaining, 3);

  const refreshed = cache.loadSubscription('one');
  assert.equal(cache.subscriptionSnapshot('one').plans[0], cache.product);
  cache.requests[1].reject(new Error('Offline'));
  const [usage] = await refreshed;
  assert.equal(usage.status, 'rejected');
  assert.equal(cache.subscriptionSnapshot('one').access.remaining, 3);
});

test('late responses from another account cannot replace the signed-in account snapshot', async () => {
  const cache = setup();
  const first = cache.loadSubscription('one');
  cache.auth.currentUser = { uid: 'two' };
  const second = cache.loadSubscription('two');
  cache.requests[1].resolve({ paid: false, remaining: 2 });
  await second;
  cache.requests[0].resolve({ paid: true, remaining: 100 });
  await first;
  assert.equal(cache.subscriptionSnapshot('two').access.remaining, 2);
  assert.equal(cache.subscriptionSnapshot('one'), undefined);
  cache.auth.currentUser = null;
  assert.equal(cache.subscriptionSnapshot('two'), undefined);
});

test('purchase and restore state can update the snapshot without fetching again', async () => {
  const cache = setup();
  const request = cache.loadSubscription('one');
  cache.requests[0].resolve({ paid: false, remaining: 3 });
  await request;
  cache.rememberSubscription('one', {
    ...cache.subscriptionSnapshot('one'),
    access: { paid: true, remaining: 100 },
  });
  assert.equal(cache.subscriptionSnapshot('one').access.paid, true);
  assert.equal(cache.requests.length, 1);
});

test('a background response cannot overwrite a newer purchase snapshot', async () => {
  const cache = setup();
  const request = cache.loadSubscription('one');
  cache.rememberSubscription('one', {
    access: { paid: true, remaining: 100 },
    customer: null,
    plans: [cache.product],
  });
  cache.requests[0].resolve({ paid: false, remaining: 3 });
  await request;
  assert.equal(cache.subscriptionSnapshot('one').access.paid, true);
});
