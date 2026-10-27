import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const withCmake = require('../../plugins/with-cmake.cjs');
test('prebuild uses local modern Ninja once without changing other Gradle content', async () => {
  const config = withCmake({ name: 'Anything', slug: 'anything' });
  const mod = config.mods.android.appBuildGradle;
  const result = await mod({
    ...config,
    modRequest: { platformProjectRoot: '/tmp/android', projectRoot: '/tmp' },
    modResults: { language: 'groovy', contents: 'android { namespace "test" }' },
  });
  assert.match(result.modResults.contents, /CMAKE_MAKE_PROGRAM/);
  assert.match(result.modResults.contents, /localNinja.isFile/);
  assert.match(result.modResults.contents, /namespace "test"/);
  const again = await mod(result);
  assert.equal(again.modResults.contents, result.modResults.contents);
});
