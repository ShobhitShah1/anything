import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { billingKey, billingError, hasPro } from './billing-config.ts';

test('Test Store key is used only in development; release requires the correct store key', () => {
  const keys = { test: 'test_example', ios: 'appl_example', android: 'goog_example' };
  assert.equal(billingKey('android', true, keys), keys.test);
  assert.equal(billingKey('ios', false, keys), keys.ios);
  assert.equal(billingKey('android', false, keys), keys.android);
  assert.throws(() => billingKey('android', false, { android: keys.test }));
  assert.throws(() => billingKey('ios', false, { ios: keys.android }));
  assert.throws(() => billingKey('web', true, {}));
});

test('canceled and pending purchases never claim to unlock access', () => {
  assert.equal(billingError({ code: '1' }), '');
  assert.equal(billingError({ userCancelled: true }), '');
  assert.match(billingError({ code: '20' }), /pending approval/);
  assert.equal(billingError({ message: 'Store is offline' }), 'Store is offline');
  assert.match(billingError(null), /try again/);
});

test('only the active anything_pro entitlement enables the subscription UI', () => {
  const info = (active) => ({ entitlements: { active } });
  assert.equal(hasPro(info({})), false);
  assert.equal(hasPro(info({ anything_plus: { isActive: true } })), false);
  assert.equal(hasPro(info({ anything_pro: { isActive: false } })), false);
  assert.equal(hasPro(info({ anything_pro: { isActive: true } })), true);
});

test('store testing builds a signed store bundle using isolated EAS environment values', () => {
  const config = JSON.parse(readFileSync(new URL('../../eas.json', import.meta.url), 'utf8'));
  assert.equal(config.cli.appVersionSource, 'remote');
  assert.equal(config.build.production.android.buildType, 'app-bundle');
  assert.equal(config.build.production.distribution, 'store');
  assert.equal(config.build.production.autoIncrement, true);
  assert.equal(config.build.production.environment, 'production');
  assert.equal(config.build['store-test'].extends, 'production');
  assert.equal(config.build['store-test'].environment, 'preview');
  assert.equal(config.submit.internal.android.track, 'internal');
  assert.equal(config.submit.internal.android.releaseStatus, 'draft');
});
