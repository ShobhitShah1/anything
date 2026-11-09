import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(new URL('./preload-assets.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

test('preloadCriticalAssets initiates and resolves critical visual assets', async () => {
  const exports = {};
  const prefetchedUris = [];
  const loadedAssets = [];

  runInNewContext(source, {
    exports,
    console: { warn() {} },
    setTimeout: (fn) => setTimeout(fn, 10),
    clearTimeout: (id) => clearTimeout(id),
    require(name) {
      if (name === 'react-native') {
        return {
          Image: {
            prefetch: async (uri) => {
              prefetchedUris.push(uri);

              return true;
            },
            resolveAssetSource: (mod) => ({ uri: `https://asset.local/${mod}` }),
          },
          Platform: { OS: 'android' },
        };
      }
      if (name === 'expo-asset') {
        return {
          Asset: {
            loadAsync: async (assets) => {
              loadedAssets.push(...assets);

              return assets;
            },
          },
        };
      }
      if (name.includes('welcome-space-dark')) return 101;
      if (name.includes('welcome-space-light')) return 102;
      if (name.includes('brand-mark')) return 103;
      if (name.includes('splash-art')) return 104;
      throw new Error(`Unexpected import: ${name}`);
    },
  });

  assert.equal(exports.CRITICAL_ASSETS.length, 4);
  assert.ok(exports.CRITICAL_ASSETS.includes(101));
  assert.ok(exports.CRITICAL_ASSETS.includes(102));

  await exports.preloadCriticalAssets();

  assert.ok(exports.isAssetsPreloaded());
  assert.equal(loadedAssets.length, 4);
  assert.equal(prefetchedUris.length, 4);
});

test('preloadCriticalAssets resolves safely within timeout even if underlying loaders throw', async () => {
  const exports = {};

  runInNewContext(source, {
    exports,
    console: { warn() {} },
    setTimeout: (fn) => setTimeout(fn, 10),
    clearTimeout: (id) => clearTimeout(id),
    require(name) {
      if (name === 'react-native') {
        return {
          Image: {
            prefetch: () => Promise.reject(new Error('Network offline')),
            resolveAssetSource: () => ({ uri: 'https://asset.local/fail' }),
          },
          Platform: { OS: 'android' },
        };
      }
      if (name === 'expo-asset') {
        return {
          Asset: {
            loadAsync: () => Promise.reject(new Error('Disk error')),
          },
        };
      }

      return 1;
    },
  });

  await exports.preloadCriticalAssets();
  assert.ok(exports.isAssetsPreloaded());
});
