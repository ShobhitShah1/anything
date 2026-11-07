import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { guestLimitReached, GuestLimitError } from './guest-limit.ts';

const items = (count) =>
  Array.from({ length: count }, (_, id) => ({ id: String(id), type: 'note' }));

test('guests can save ten, edit and delete, but new items above ten require login', () => {
  assert.equal(guestLimitReached(items(9), items(10), false), false);
  assert.equal(guestLimitReached(items(10), items(11), false), true);
  assert.equal(guestLimitReached(items(9), items(12), false), true);
  assert.equal(guestLimitReached(items(12), items(12), false), false);
  assert.equal(guestLimitReached(items(12), items(11), false), false);
  assert.equal(guestLimitReached(items(10), items(50), true), false);
});

const source = ts.transpileModule(
  readFileSync(new URL('../state/collection.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

function collection(count, loginSucceeds = true, development = true) {
  const exports = {},
    writes = [],
    states = [],
    refs = [];
  let stateIndex = 0,
    refIndex = 0;
  const auth = { currentUser: null };
  const empty = { items: items(count), folders: [], journals: {}, theme: 'light', syncUid: '' };
  runInNewContext(source, {
    exports,
    __DEV__: development,
    require(name) {
      if (name === 'react')
        return {
          createContext: () => 'Context',
          useCallback: (fn) => fn,
          useEffect: () => {},
          useRef: (current) => (refs[refIndex++] ??= { current }),
          useState(initial) {
            const index = stateIndex++;
            if (index === 5) initial = true;
            if (!(index in states)) states[index] = initial;
            return [
              states[index],
              (value) => {
                states[index] = value;
              },
            ];
          },
        };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      if (name === 'react-native') return { useColorScheme: () => 'light' };
      if (name === '../services/auth')
        return {
          auth,
          login: async () => {
            if (loginSucceeds) auth.currentUser = { uid: 'signed-in' };
          },
        };
      if (name === '../theme') return { palettes: { light: {} } };
      if (name === '../utils/collection-data') return { emptyCollection: empty };
      if (name === '../utils/guest-limit') return { guestLimitReached, GuestLimitError };
      if (name === '../utils/device-storage')
        return { saveText: async (_, __, value) => writes.push(JSON.parse(value)) };
      return {};
    },
  });
  const render = () => {
    stateIndex = refIndex = 0;
    return exports.CollectionProvider({ children: null }).props.value;
  };
  const state = render();
  return { state, render, auth, writes, states };
}

test('profile-wide development Pro is account-scoped, reversible and never persisted', () => {
  for (const development of [false, true]) {
    const app = collection(10, true, development);
    app.states[4] = { uid: 'one' };
    app.render().setDevPro(true);
    assert.equal(app.render().pro, development);
    assert.equal(app.render().devPro, development);
    assert.equal(app.writes.length, 0);
    app.states[4] = { uid: 'two' };
    assert.equal(app.render().pro, false);
    app.states[4] = { uid: 'one' };
    app.render().setDevPro(false);
    assert.equal(app.render().pro, false);
  }
});

test('real membership updates the whole profile independently of development preview', () => {
  const app = collection(10, true, false);
  app.states[4] = { uid: 'one' };
  app.render().setMembership({ uid: 'one', active: true });
  assert.equal(app.render().pro, true);
  app.render().setMembership({ uid: 'one', active: false });
  assert.equal(app.render().pro, false);
});

test('serialized saves cannot race past ten, and signing in unlocks saving', async () => {
  const { state, auth, writes, states } = collection(9);
  const results = await Promise.allSettled([
    state.save({ id: 'a', type: 'note' }),
    state.save({ id: 'b', type: 'note' }),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.ok(results[1].reason instanceof GuestLimitError);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].items.length, 10);
  assert.ok(states.includes('saves'));
  auth.currentUser = { uid: 'signed-in' };
  await state.save({ id: 'b', type: 'note' });
  assert.equal(writes[1].items.length, 11);
});

test('an oversized import is rejected before any device write; existing items stay editable', async () => {
  const { state, writes } = collection(10);
  await assert.rejects(
    state.commit((value) => ({ ...value, items: items(20) })),
    GuestLimitError,
  );
  assert.equal(writes.length, 0);
  await state.save({ id: '0', type: 'note', title: 'Edited' });
  assert.equal(writes[0].items.length, 10);
  assert.equal(writes[0].items[0].title, 'Edited');
});

test('successful login enables cloud sync and keeps the local collection intact', async () => {
  const { state, writes } = collection(10);
  await state.signIn();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].syncUid, 'signed-in');
  assert.equal(writes[0].items.length, 10);
});

test('cancelled login never enables sync or writes collection data', async () => {
  const { state, writes } = collection(10, false);
  await state.signIn();
  assert.equal(writes.length, 0);
});
