import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(new URL('../services/ai.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function service({
  endpoint = 'https://worker.example/ai',
  signedIn = true,
  dev = true,
  tokenError,
  fetchImpl = async () => Response.json({ remaining: 3 }),
} = {}) {
  const logs = [];
  const calls = [];
  const exports = {};
  runInNewContext(source, {
    exports,
    __DEV__: dev,
    URL,
    AbortSignal,
    Date,
    process: { env: { EXPO_PUBLIC_AI_URL: endpoint } },
    console: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    require(name) {
      if (name === 'expo/fetch')
        return {
          fetch: async (...args) => {
            calls.push(args);
            return fetchImpl(...args);
          },
        };
      if (name === './auth')
        return {
          auth: {
            currentUser: signedIn
              ? {
                  getIdToken: async () => {
                    if (tokenError) throw tokenError;
                    return 'private-firebase-token';
                  },
                }
              : null,
          },
        };
      if (name === '../utils/groq') return {};
      throw new Error(`Unexpected module ${name}`);
    },
  });
  return { ...exports, logs, calls };
}
const signal = () => new AbortController().signal;

test('missing or invalid AI endpoints give a configuration error before sending credentials', async () => {
  for (const endpoint of [
    '',
    'gsk_private',
    'http://worker.example/ai',
    'https://worker.example',
    'https://user:secret@worker.example/ai',
    'https://worker.example/ai?key=private',
  ]) {
    const ai = service({ endpoint });
    await assert.rejects(
      ai.getAiAccess(signal()),
      (error) =>
        error.code === 'configuration_missing' && error.message.includes('EXPO_PUBLIC_AI_URL'),
    );
    assert.equal(ai.calls.length, 0);
    assert.equal(ai.logs.at(-1)[1].stage, 'configuration');
    assert.ok(!JSON.stringify(ai.logs).includes('private'));
  }
});

test('logs identify sign-in, token, network and backend failures without exposing private data', async () => {
  const cases = [
    [{ signedIn: false }, 'sign_in'],
    [{ tokenError: new Error('private-token-detail') }, 'firebase_token'],
    [
      {
        fetchImpl: async () => {
          throw new Error('private-network-detail');
        },
      },
      'network',
    ],
    [
      {
        fetchImpl: async () =>
          Response.json({ error: 'unavailable', message: 'Try again' }, { status: 503 }),
      },
      'backend_response',
    ],
  ];
  for (const [options, stage] of cases) {
    const ai = service(options);
    await assert.rejects(ai.getAiAccess(signal()));
    assert.equal(ai.logs.at(-1)[1].stage, stage);
    assert.ok(!JSON.stringify(ai.logs).includes('private'));
  }
});

test('successful requests use the authenticated Worker and report HTTP status only in development', async () => {
  const ai = service({ endpoint: '  https://worker.example/ai  ' });
  assert.deepEqual(await ai.getAiAccess(signal()), { remaining: 3 });
  assert.equal(ai.calls[0][0], 'https://worker.example/ai');
  assert.equal(ai.calls[0][1].headers.Authorization, 'Bearer private-firebase-token');
  assert.equal(ai.logs.at(-1)[1].status, 200);
  assert.ok(!JSON.stringify(ai.logs).includes('private'));
  const release = service({ dev: false });
  await release.getAiAccess(signal());
  assert.equal(release.logs.length, 0);
});
