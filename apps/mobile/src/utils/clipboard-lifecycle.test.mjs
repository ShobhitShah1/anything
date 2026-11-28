import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../state/collection.tsx', import.meta.url), 'utf8');
const gateStart = source.indexOf('  const canCaptureClipboard =');
const effectStart = source.indexOf('  useEffect(() => {', gateStart);
const gate = source.slice(gateStart, effectStart);
const effect = source.slice(
  effectStart + '  useEffect(() => {'.length,
  source.indexOf('  }, [canCaptureClipboard, capture]);', effectStart),
);

function setup({
  enabled = true,
  ready = true,
  authReady = true,
  uid = '',
  count = 0,
  fail = false,
  read,
} = {}) {
  const listeners = new Map();
  const saved = [];
  let text = 'first';
  let interval;
  let failures = Number(fail);
  const AppState = {
    currentState: 'active',
    addEventListener: (name, fn) => {
      listeners.set(name, fn);

      return { remove: () => listeners.delete(name) };
    },
  };
  const cleanup = runInNewContext(
    ts.transpile(`(function() { ${gate} ${effect} })()`, { target: ts.ScriptTarget.ES2022 }),
    {
      ready,
      authReady,
      uid,
      GUEST_ITEM_LIMIT: 10,
      data: { autoClipboard: enabled, items: Array(count) },
      AppState,
      Platform: { OS: 'android' },
      Clipboard: { getStringAsync: read ?? (async () => text) },
      lastClipboard: { current: '' },
      capture: async (value) => {
        if (failures-- > 0) throw new Error('Disk full');
        saved.push(value);
      },
      setInterval: (fn) => {
        interval = fn;

        return 1;
      },
      clearInterval: () => {},
    },
  );

  return {
    saved,
    listeners,
    AppState,
    cleanup,
    tick: () => interval?.(),
    setText: (value) => {
      text = value;
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('checks at startup and resume, ignores duplicates and background polling', async () => {
  const app = setup();

  await flush();
  assert.deepEqual(app.saved, ['first']);
  app.AppState.currentState = 'background';
  app.setText('second');
  app.tick();
  await flush();
  assert.deepEqual(app.saved, ['first']);
  app.AppState.currentState = 'active';
  app.listeners.get('change')('active');
  await flush();
  app.listeners.get('focus')();
  await flush();
  assert.deepEqual(app.saved, ['first', 'second']);
  app.cleanup();
  app.tick();
  await flush();
  assert.equal(app.listeners.size, 0);
});
test('failed capture retries the same clipboard instead of marking it handled', async () => {
  const app = setup({ fail: true });

  await flush();
  app.tick();
  await flush();
  assert.deepEqual(app.saved, ['first']);
});
test('clipboard capture waits for storage and auth, and stays idle when disabled or at the guest limit', async () => {
  for (const options of [
    { enabled: false },
    { ready: false },
    { authReady: false },
    { count: 10 },
  ]) {
    const app = setup(options);

    await flush();
    assert.equal(app.listeners.size, 0);
    assert.deepEqual(app.saved, []);
  }

  const signedIn = setup({ uid: 'restored-account', count: 10 });

  await flush();
  assert.deepEqual(signedIn.saved, ['first']);
});

test('Android focus retries a startup read that began before clipboard access', async () => {
  let finishFirstRead;
  const firstRead = new Promise((resolve) => {
    finishFirstRead = resolve;
  });
  const link = 'https://example.com/copied-link';
  let reads = 0;
  const app = setup({ read: () => (reads++ === 0 ? firstRead : Promise.resolve(link)) });

  app.listeners.get('focus')();
  finishFirstRead('');
  await flush();
  assert.deepEqual(app.saved, [link]);
});
