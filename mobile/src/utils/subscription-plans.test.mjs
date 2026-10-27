import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionPlans } from './subscription-plans.ts';

const annual = {
  identifier: 'store-year',
  product: { subscriptionPeriod: 'P1Y', priceString: '¥9,800', pricePerMonthString: '¥817' },
};
const monthly = {
  identifier: 'store-month',
  product: { subscriptionPeriod: 'P1M', priceString: '¥980', pricePerMonthString: '¥980' },
};

test('plans use actual localized store prices and exact purchase packages', () => {
  const plans = subscriptionPlans([monthly, annual]);
  assert.equal(plans[0].price, '¥9,800');
  assert.equal(plans[0].storePackage, annual);
  assert.equal(plans[0].period, 'year');
  assert.match(plans[0].detail, /¥817/);
  assert.equal(plans[1].price, '¥980');
  assert.equal(plans[1].storePackage, monthly);
  assert.equal(plans[1].period, 'month');
});

test('live plans never invent offers or label unsupported billing periods as monthly', () => {
  assert.deepEqual(subscriptionPlans([]), []);
  assert.deepEqual(
    subscriptionPlans([
      { identifier: 'lifetime', product: { subscriptionPeriod: null, priceString: '$99' } },
    ]),
    [],
  );
  assert.equal(
    subscriptionPlans([{ ...annual, product: { ...annual.product, pricePerMonthString: null } }])[0]
      .detail,
    'Billed yearly',
  );
});

test('package names never invent a billing period or a price', () => {
  assert.deepEqual(
    subscriptionPlans([
      {
        ...annual,
        identifier: 'yearly',
        product: { subscriptionPeriod: null, priceString: '$30' },
      },
      {
        ...monthly,
        identifier: 'monthly',
        product: { subscriptionPeriod: 'P1M', priceString: '' },
      },
      { ...annual, product: { ...annual.product, subscriptionPeriod: 'P1W' } },
    ]),
    [],
  );
});

test('product IDs can change in the current offering without a new app SKU list', () => {
  const changed = {
    ...monthly,
    identifier: 'a-new-package',
    product: { ...monthly.product, identifier: 'new-subscription:new-base-plan' },
  };
  assert.equal(subscriptionPlans([changed])[0].storePackage, changed);
  assert.equal(subscriptionPlans([changed])[0].price, changed.product.priceString);
});

test('annual savings compare real prices in the same currency only', () => {
  const year = { ...annual, product: { ...annual.product, price: 80, currencyCode: 'USD' } };
  const month = { ...monthly, product: { ...monthly.product, price: 10, currencyCode: 'USD' } };
  assert.equal(subscriptionPlans([year, month])[0].savings, 33);
  assert.equal(subscriptionPlans([year])[0].savings, 0);
  for (const price of [0, -1, NaN, Infinity, 130]) {
    assert.equal(
      subscriptionPlans([{ ...year, product: { ...year.product, price } }, month])[0].savings,
      0,
    );
  }
  assert.equal(
    subscriptionPlans([year, { ...month, product: { ...month.product, currencyCode: 'EUR' } }])[0]
      .savings,
    0,
  );
  assert.equal(subscriptionPlans([annual, monthly])[0].savings, 0);
});
