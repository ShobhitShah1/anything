import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(
  readFileSync(new URL('../components/ai-response-status.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
function render(phase, reduced = false) {
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  runInNewContext(source, {
    exports,
    require: (name) => {
      if (name === 'react') return { memo: (component) => component };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-native') return { Text: 'Text', View: 'View' };
      if (name === 'react-native-reanimated')
        return { __esModule: true, default: { View: 'Animated' }, useReducedMotion: () => reduced };
      if (name === '../state/collection')
        return {
          useCollection: () => ({ colors: { ink: '#e7e7ec', muted: '#94949f', line: '#29292e' } }),
        };
      if (name === '../theme') return { fonts: { editorial: 'serif' } };
      throw new Error(name);
    },
  });
  const nodes = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    nodes.push(node);
    visit(node.props.children);
  };
  visit(exports.AiResponseStatus({ prompt: 'A reading list for later', phase }));
  return nodes;
}
test('generation announces waiting, writing and completion without retaining loading placeholders', () => {
  for (const [phase, label, animated] of [
    ['thinking', 'Preparing your draft', 4],
    ['streaming', 'Writing your draft', 1],
    ['idle', 'Your draft', 0],
  ]) {
    const nodes = render(phase);
    const status = nodes.find((node) => node.props.accessibilityLiveRegion === 'polite');
    assert.equal(status.props.accessibilityLabel, label);
    assert.equal(status.props.accessibilityState.busy, phase !== 'idle');
    assert.equal(nodes.filter((node) => node.type === 'Animated').length, animated);
    assert.ok(
      nodes
        .filter((node) => node.type === 'Text')
        .every((node) => node.props.allowFontScaling === false),
    );
  }
});
test('reduced motion keeps generation readable without any looping animation', () => {
  const indicators = render('thinking', true).filter((node) => node.type === 'Animated');
  assert.equal(indicators.length, 4);
  assert.ok(indicators.every((node) => node.props.style.animationName === undefined));
});
