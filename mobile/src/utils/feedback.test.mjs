import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(
  readFileSync(new URL('../components/feedback.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

function feedback(error = '', notice = '') {
  const state = { error, notice };
  const timers = [];
  const exports = {};
  state.setError = (next) => {
    state.error = typeof next === 'function' ? next(state.error) : next;
  };
  state.setNotice = (next) => {
    state.notice = typeof next === 'function' ? next(state.notice) : next;
  };
  const animation = { duration: () => animation, easing: () => animation };
  runInNewContext(source, {
    exports,
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeout: () => {},
    require(name) {
      if (name === 'react') return { useEffect: (effect) => effect() };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react-native') return { useWindowDimensions: () => ({ width: 390 }) };
      if (name === 'lucide-react-native') return {};
      if (name === 'react-native-reanimated')
        return {
          default: { View: 'AnimatedView' },
          useReducedMotion: () => true,
          FadeIn: animation,
          FadeOut: animation,
        };
      if (name === 'react-native-safe-area-context')
        return { useSafeAreaInsets: () => ({ top: 24 }) };
      if (name === '../state/collection') return { useCollection: () => state };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return { state, timers, view: exports.FeedbackHost() };
}

test('toast dismissal clears the visible error and any queued notice', () => {
  const toast = feedback('Save failed', 'Saved earlier');
  assert.equal(toast.view.props.style.top, 32);
  toast.view.props.children.props.onDismiss();
  assert.equal(toast.state.error, '');
  assert.equal(toast.state.notice, '');
});

test('toast messages expire and an old timer never clears a newer error', () => {
  const error = feedback('Save failed', 'Older notice');
  assert.equal(error.timers[0].delay, 3000);
  error.timers[0].callback();
  assert.equal(error.state.error, '');
  assert.equal(error.state.notice, '');
  const changed = feedback('First error');
  changed.state.error = 'New error';
  changed.timers[0].callback();
  assert.equal(changed.state.error, 'New error');
  const notice = feedback('', 'Copied');
  assert.equal(notice.timers[0].delay, 1800);
  notice.state.notice = 'New notice';
  notice.timers[0].callback();
  assert.equal(notice.state.notice, 'New notice');
  assert.equal(feedback().view, null);
});
