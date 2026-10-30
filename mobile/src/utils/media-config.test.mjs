import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import config from '../../app.config.ts';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

test('image and browser native modules replace Expo Image in dependencies and config', () => {
  assert.ok(pkg.dependencies['react-native-fast-image']);
  assert.ok(pkg.dependencies['expo-web-browser']);
  assert.equal(pkg.dependencies['expo-image'], undefined);
  const plugins = config.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  assert.ok(plugins.includes('react-native-fast-image'));
  assert.ok(plugins.includes('expo-web-browser'));
  assert.ok(!plugins.includes('expo-image'));
});

test('experimental shared image transitions stay disabled', () => {
  assert.notEqual(pkg.reanimated?.staticFeatureFlags?.ENABLE_SHARED_ELEMENT_TRANSITIONS, true);
});

test('release builds shrink unused code and resources through Expo configuration', () => {
  const plugin = config.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === 'expo-build-properties',
  );
  assert.equal(plugin[1].android.enableMinifyInReleaseBuilds, true);
  assert.equal(plugin[1].android.enableShrinkResourcesInReleaseBuilds, true);
  assert.equal(plugin[1].android.enableBundleCompression, true);
  assert.equal(plugin[1].android.gifEnabled, false);
  assert.equal(plugin[1].android.webpEnabled, false);
});

test('compact APK packaging is opt-in and does not restrict production device support', () => {
  const source = ts.transpileModule(
    readFileSync(new URL('../../app.config.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  for (const profile of ['production', 'store-test', 'development', 'preview', 'preview-arm64']) {
    const exports = {};
    runInNewContext(source, { exports, process: { env: { EAS_BUILD_PROFILE: profile } } });
    const plugin = exports.default.plugins.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-build-properties',
    );
    const android = plugin[1].android;
    assert.equal(android.useLegacyPackaging, profile === 'preview-arm64');
    if (profile === 'preview-arm64')
      assert.deepEqual(Array.from(android.buildArchs), ['arm64-v8a']);
    else
      assert.deepEqual(Array.from(android.buildArchs), [
        'armeabi-v7a',
        'arm64-v8a',
        'x86',
        'x86_64',
      ]);
  }
  const eas = JSON.parse(readFileSync(new URL('../../eas.json', import.meta.url), 'utf8'));
  assert.equal(eas.build['preview-arm64'].extends, 'preview');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
});

test('AI calls the authenticated backend without bundling provider keys or an audio recorder', () => {
  const plugins = config.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  assert.ok(!plugins.includes('expo-secure-store'));
  assert.ok(!plugins.includes('expo-audio'));
  assert.equal(pkg.dependencies['expo-audio'], undefined);
  assert.equal(pkg.dependencies['expo-speech'], undefined);
  const service = readFileSync(new URL('../services/ai.ts', import.meta.url), 'utf8');
  assert.ok(service.includes('process.env.EXPO_PUBLIC_AI_URL'));
  assert.ok(service.includes('getIdToken()'));
  assert.ok(!service.includes('EXPO_PUBLIC_GROQ'));
  assert.ok(!service.includes('api.groq.com'));
  assert.ok(!service.includes('SecureStore'));
});

test('both package managers lock the new native modules', () => {
  const lock = JSON.parse(
    readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'),
  );
  const yarn = readFileSync(new URL('../../yarn.lock', import.meta.url), 'utf8');
  assert.ok(yarn.includes('__metadata:'));
  for (const name of [
    'react-native-fast-image',
    'expo-build-properties',
    'expo-web-browser',
    'expo-speech-recognition',
    'expo-asset',
    'react-native-enriched-markdown',
    'react-native-purchases',
  ]) {
    assert.equal(lock.packages[''].dependencies[name], pkg.dependencies[name]);
    assert.ok(lock.packages[`node_modules/${name}`]);
    assert.ok(yarn.includes(`${name}@npm:`));
  }
});

test('mobile targets native platforms without the replaced Markdown or web renderers', () => {
  assert.deepEqual(config.platforms, ['ios', 'android']);
  for (const name of ['react-dom', 'react-native-web', 'react-native-markdown-display'])
    assert.equal(pkg.dependencies[name], undefined);
  assert.ok(pkg.dependencies['react-native-enriched-markdown']);
  assert.equal(pkg.dependenciesMeta['react-native-enriched-markdown'].built, true);
  assert.equal(pkg['enriched-markdown'].enableCodeHighlight, true);
});

test('live dictation config includes microphone and speech recognition permissions', () => {
  const plugin = config.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === 'expo-speech-recognition',
  );
  assert.ok(plugin);
  assert.ok(plugin[1].microphonePermission);
  assert.ok(plugin[1].speechRecognitionPermission);
});
