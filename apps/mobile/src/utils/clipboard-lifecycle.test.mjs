import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../state/collection.tsx', import.meta.url), 'utf8');
const effect = source.slice(
  source.indexOf('    if (!ready || !data.autoClipboard) return;'),
  source.indexOf('  }, [ready, data.autoClipboard, capture]);'),
);

function setup({ enabled = true, ready = true, fail = false } = {}) {
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
    ts.transpile(`(function() { ${effect} })()`, { target: ts.ScriptTarget.ES2022 }),
    {
      ready,
      data: { autoClipboard: enabled },
      AppState,
      Platform: { OS: 'android' },
      Clipboard: { getStringAsync: async () => text },
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
test('disabled capture and unhydrated storage never read the clipboard', async () => {
  for (const options of [{ enabled: false }, { ready: false }]) {
    const app = setup(options);

    await flush();
    assert.equal(app.listeners.size, 0);
    assert.deepEqual(app.saved, []);
  }
});
