import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function setup({ cancel = false, offline = false, writeFails = false } = {}) {
  const writes = [],
    files = [],
    removed = [],
    requests = [],
    exports = {};
  const source = ts.transpileModule(
    readFileSync(new URL('./download-image.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    Uint8Array,
    require(name) {
      if (name === 'expo-file-system')
        return {
          Directory: {
            pickDirectoryAsync: async () => {
              if (cancel) throw new Error('The file picker was cancelled by the user');
              return {
                createFile: (name, mime) => {
                  files.push({ name, mime });
                  return {
                    write: async (contents, options) => {
                      if (writeFails) throw new Error('Disk full');
                      writes.push({ contents, options });
                    },
                    delete: () => removed.push(name),
                  };
                },
              };
            },
          },
          File: class {
            type = 'image/png';
            async bytes() {
              return new Uint8Array([1, 2, 3]);
            }
          },
        };
      if (name === 'expo/fetch')
        return {
          fetch: async (uri) => {
            requests.push(uri);
            return {
              ok: !offline,
              headers: { get: () => 'image/webp; charset=binary' },
              bytes: async () => new Uint8Array([4, 5, 6]),
            };
          },
        };
      throw new Error(name);
    },
  });
  return { download: exports.downloadImage, writes, files, removed, requests };
}
test('embedded images export binary base64 with the correct MIME type', async () => {
  const app = setup();
  assert.equal(await app.download('data:image/png;base64,AQID'), true);
  assert.equal(app.writes[0].contents, 'AQID');
  assert.equal(app.writes[0].options.encoding, 'base64');
  assert.equal(app.files[0].mime, 'image/png');
  assert.match(app.files[0].name, /\.png$/);
});
test('remote URLs use the response MIME type, including URLs without an extension', async () => {
  const app = setup();
  await app.download('https://example.com/photo?id=1');
  assert.equal(app.files[0].mime, 'image/webp');
  assert.deepEqual([...app.writes[0].contents], [4, 5, 6]);
});
test('local images export bytes without changing the original', async () => {
  const app = setup();
  await app.download('file:///original.png');
  assert.deepEqual([...app.writes[0].contents], [1, 2, 3]);
  assert.equal(app.removed.length, 0);
});
test('cancelling the picker does not fetch or write', async () => {
  const app = setup({ cancel: true });
  assert.equal(await app.download('https://example.com/image.png'), false);
  assert.equal(app.requests.length, 0);
  assert.equal(app.files.length, 0);
});
test('failed network requests create no destination file', async () => {
  const app = setup({ offline: true });
  await assert.rejects(app.download('https://example.com/image.png'), /Could not download/);
  assert.equal(app.files.length, 0);
});
test('failed exports remove the partial destination and preserve the error', async () => {
  const app = setup({ writeFails: true });
  await assert.rejects(app.download('data:image/png;base64,AQID'), /Disk full/);
  assert.equal(app.removed.length, 1);
});
