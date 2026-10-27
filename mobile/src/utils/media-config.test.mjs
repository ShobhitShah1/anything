import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
