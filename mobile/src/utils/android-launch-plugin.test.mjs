import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { patchActivity } = require('../../plugins/with-android-launch.cjs');

test('custom Android activity draws native artwork and removes the old Expo controller idempotently', () => {
  const source = `package app.anything.mobile
import expo.modules.splashscreen.SplashScreenManager
class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen - expo prebuild sync-test
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }
}`;
  const patched = patchActivity(source);
  assert.ok(!patched.includes('SplashScreenManager'));
  assert.match(
    patched,
    /setTheme\(R.style.AppTheme\)\s+super.onCreate\(null\)\s+AnythingLaunch.show\(this\)/,
  );
  assert.equal(patchActivity(patched), patched);
  assert.throws(() => patchActivity('unrecognized activity'), /expects the Expo Kotlin/);
});

test('custom Android module is autolinkable and has the full-screen artwork drawable', () => {
  const config = JSON.parse(
    readFileSync(
      new URL('../../modules/anything-launch/expo-module.config.json', import.meta.url),
      'utf8',
    ),
  );
  assert.deepEqual(config.android.modules, ['expo.modules.anythinglaunch.AnythingLaunchModule']);
  const native = readFileSync(
    new URL(
      '../../modules/anything-launch/android/src/main/java/expo/modules/anythinglaunch/AnythingLaunch.kt',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(native, /ScaleType.CENTER_CROP/);
  assert.match(native, /R.drawable.anything_launch_art/);
  assert.ok(native.indexOf('removeView(this)') < native.indexOf('setImageDrawable(null)'));
});
