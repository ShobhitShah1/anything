import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(new URL('../services/auth.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function restoredSession({
  previous = true,
  expo = false,
  googleFailure = false,
  firebaseFailure = false,
} = {}) {
  const events = [];
  const account = { currentUser: { uid: 'restored-user' } };
  let configured = false;
  const exports = {};
  runInNewContext(source, {
    exports,
    process: { env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'test-web-client' } },
    require(name) {
      if (name === 'firebase/auth')
        return {
          getReactNativePersistence: () => 'persistence',
          initializeAuth: () => account,
          signOut: async () => {
            events.push('firebase-out');
            if (firebaseFailure) throw new Error('Firebase sign-out failed');
            account.currentUser = null;
          },
        };
      if (name === './firebase-app') return { firebaseApp: {} };
      if (name === '@react-native-async-storage/async-storage') return { default: {} };
      if (name === 'expo-constants') return { default: { appOwnership: expo ? 'expo' : null } };
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === '@react-native-google-signin/google-signin') {
        events.push('google-import');
        return {
          GoogleSignin: {
            configure(options) {
              assert.equal(options.webClientId, 'test-web-client');
              events.push('configure');
              configured = true;
            },
            hasPreviousSignIn: () => previous,
            signOut: async () => {
              if (!configured) throw new Error('apiClient is null - call configure() first');
              events.push('google-out');
              if (googleFailure) throw new Error('Google cleanup failed');
            },
          },
        };
      }
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return { logout: exports.logout, account, events };
}

test('logout after a cold-start restored session configures Google before native sign-out', async () => {
  const app = restoredSession();
  await app.logout();
  assert.equal(app.account.currentUser, null);
  assert.deepEqual(app.events, ['firebase-out', 'google-import', 'configure', 'google-out']);
});

test('logout works without a cached Google account and in Expo Go', async () => {
  for (const options of [{ previous: false }, { expo: true }]) {
    const app = restoredSession(options);
    await app.logout();
    assert.equal(app.account.currentUser, null);
    assert.ok(!app.events.includes('google-out'));
    if (options.expo) assert.deepEqual(app.events, ['firebase-out']);
  }
});

test('Google cleanup failure cannot leave the Firebase session signed in', async () => {
  const app = restoredSession({ googleFailure: true });
  await assert.rejects(app.logout(), /Google cleanup failed/);
  assert.equal(app.account.currentUser, null);
});

test('a Firebase sign-out failure is surfaced before touching the Google session', async () => {
  const app = restoredSession({ firebaseFailure: true });
  await assert.rejects(app.logout(), /Firebase sign-out failed/);
  assert.ok(app.account.currentUser);
  assert.deepEqual(app.events, ['firebase-out']);
});
