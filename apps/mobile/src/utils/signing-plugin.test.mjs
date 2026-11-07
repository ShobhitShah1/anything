import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const withSigning = require('../../plugins/with-signing.cjs');

test('both Android variants use private credentials, with no embedded passwords', async () => {
  const config = withSigning({ name: 'Anything', slug: 'anything' });
  const mod = config.mods.android.appBuildGradle;
  const result = await mod({
    ...config,
    modRequest: { platformProjectRoot: '/tmp/android', projectRoot: '/tmp' },
    modResults: { language: 'groovy', contents: 'android { namespace "app.anything.mobile" }' },
  });
  const gradle = result.modResults.contents;
  assert.match(gradle, /debug \{ signingConfig signingConfigs.anythingRelease \}/);
  assert.match(gradle, /release \{ signingConfig signingConfigs.anythingRelease \}/);
  assert.match(gradle, /storePassword key.keystorePassword/);
  assert.match(gradle, /credentials are missing/);
  assert.match(gradle, /namespace "app.anything.mobile"/);
  assert.equal((await mod(result)).modResults.contents, gradle);
});
