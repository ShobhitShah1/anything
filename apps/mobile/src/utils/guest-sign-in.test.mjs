import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('home shows the upgrade chip only when free, and a gold portrait ring and crown when Pro', () => {
  const file = ts.createSourceFile(
    'index.tsx',
    readFileSync(new URL('../app/index.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let header;
  function find(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'headerRight')
      header = node.initializer.getText(file);
    ts.forEachChild(node, find);
  }
  find(file);
  const code = ts.transpileModule(`exports.header = ${header}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const pro of [false, true]) {
    const exports = {};
    const jsx = (type, props) => ({ type, props });
    runInNewContext(code, {
      exports,
      require: () => ({ jsx, jsxs: jsx }),
      state: { pro, user: { photoURL: 'https://example.com/avatar.png' } },
      colors: { ink: '#111' },
      captureOpen: false,
      homeHeaderStyle: {},
      captureHeaderStyle: {},
      StyleSheet: { absoluteFill: {} },
      ai: { generated: null },
      View: 'View',
      Pressable: 'Pressable',
      Image: 'Image',
      Crown: 'Crown',
      UserRound: 'UserRound',
      PlusCard: 'PlusCard',
      Animated: { View: 'AnimatedView' },
    });
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(exports.header());
    assert.equal(nodes.filter((node) => node.type === 'PlusCard').length, pro ? 0 : 1);
    assert.equal(nodes.filter((node) => node.type === 'Crown').length, pro ? 1 : 0);
    const ring = nodes.find((node) => node.props.style?.borderColor === '#E8B849');
    assert.equal(ring.props.style.borderWidth, pro ? 2 : 0);
  }
});

function setup(file, prompt = 'pro', signedIn = false) {
  const source = ts.transpileModule(
    readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText;
  const routes = [],
    prompts = [],
    exports = {};
  const auth = { currentUser: signedIn ? { uid: 'one' } : null };
  const state = {
    colors: {},
    dark: false,
    busy: false,
    signInPrompt: prompt,
    user: auth.currentUser,
    setSignInPrompt: (value) => prompts.push(value),
    setNotice: () => {},
    signIn: async () => {},
  };
  const jsx = (type, props) => ({ type, props });
  runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-native') return { Text: 'Text', View: 'View', Pressable: 'Pressable' };
      if (name === '@expo/ui')
        return { Host: 'Host', BottomSheet: 'Sheet', RNHostView: 'RNHostView' };
      if (name === 'expo-router') return { router: { push: (path) => routes.push(path) } };
      if (name === 'react-native-safe-area-context')
        return { useSafeAreaInsets: () => ({ bottom: 20 }) };
      if (name === '../state/collection') return { useCollection: () => state };
      if (name === '../services/auth') return { auth };
      if (name === './ui') return { Action: 'Action' };
      if (name === '../theme') return { fonts: {} };
      return {};
    },
  });
  function nodes(view) {
    const result = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      result.push(node);
      visit(node.props?.children);
    }
    visit(view);
    return result;
  }
  return { exports, state, auth, routes, prompts, nodes };
}

test('Pro remains visible for guests and asks for sign-in before navigating', () => {
  for (const signedIn of [false, true]) {
    const ui = setup('plus-card', null, signedIn);
    const button = ui.exports.PlusCard({ compact: true });
    assert.equal(button.props.accessibilityRole, 'button');
    button.props.onPress();
    assert.deepEqual(ui.routes, signedIn ? ['/subscription'] : []);
    assert.deepEqual(ui.prompts, signedIn ? [] : ['pro']);
  }
});

test('active profile replaces upgrade labels with Pro and membership management', () => {
  const ui = setup('plus-card', null, true);
  ui.state.pro = true;
  const compact = ui.exports.PlusCard({ compact: true });
  assert.equal(compact.props.accessibilityLabel, 'Manage Anything Pro');
  assert.ok(ui.nodes(compact).some((node) => node.props.children === 'Pro'));
  const full = ui.exports.PlusCard({});
  assert.ok(ui.nodes(full).some((node) => node.props.children === 'Manage membership'));
  compact.props.onPress();
  assert.deepEqual(ui.routes, ['/subscription']);
});

test('cancelled login stays on the prompt; successful Pro login opens membership', async () => {
  const ui = setup('sign-in-sheet');
  const button = ui
    .nodes(ui.exports.SignInSheet())
    .find((node) => node.props.title === 'Continue with Google');
  button.props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(ui.routes, []);
  assert.deepEqual(ui.prompts, []);
  ui.state.signIn = async () => {
    ui.auth.currentUser = { uid: 'one' };
  };
  button.props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(ui.routes, ['/subscription']);
  assert.deepEqual(ui.prompts, [null]);
});

test('save-limit prompt allows dismissal and never navigates to paid plans', async () => {
  const ui = setup('sign-in-sheet', 'saves');
  const nodes = ui.nodes(ui.exports.SignInSheet());
  assert.ok(
    nodes
      .filter((node) => node.type === 'Text')
      .every((node) => node.props.allowFontScaling === false),
  );
  nodes.find((node) => node.props.title === 'Not now').props.onPress();
  assert.deepEqual(ui.prompts, [null]);
  ui.state.signIn = async () => {
    ui.auth.currentUser = { uid: 'one' };
  };
  nodes.find((node) => node.props.title === 'Continue with Google').props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(ui.routes, []);
});
