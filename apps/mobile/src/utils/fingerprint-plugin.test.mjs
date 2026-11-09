import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const withFingerprintFix = require('../../plugins/with-fingerprint-fix.cjs');

test('fingerprint fix disables createExpoFingerprint in root project Gradle', async () => {
  const config = withFingerprintFix({ name: 'Anything', slug: 'anything' });
  const mod = config.mods.android.projectBuildGradle;
  const result = await mod({
    ...config,
    modRequest: { platformProjectRoot: '/tmp/android', projectRoot: '/tmp' },
    modResults: { language: 'groovy', contents: 'allprojects {}' },
  });
  const gradle = result.modResults.contents;

  assert.match(gradle, /gradle\.projectsEvaluated/);
  assert.match(gradle, /createExpoFingerprint/);
  assert.match(gradle, /enabled = false/);
  assert.equal((await mod(result)).modResults.contents, gradle);
});
