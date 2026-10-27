import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { contextGeometry } from './context-geometry.ts';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(
  readFileSync(new URL('../components/card-context-menu.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

function menu(reduced = false) {
  const states = [],
    shared = [],
    exports = {};
  let stateIndex = 0,
    sharedIndex = 0;
  runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'react')
        return {
          useCallback: (fn) => fn,
          useEffect: () => {},
          useRef: (current) => ({ current }),
          useReducer: () => ['open', () => {}],
          useState(initial) {
            const index = stateIndex++;
            if (!(index in states)) states[index] = initial;
            return [
              states[index],
              (value) => {
                states[index] = value;
              },
            ];
          },
        };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react-native')
        return {
          Modal: 'Modal',
          ScrollView: 'ScrollView',
          useWindowDimensions: () => ({ width: 390, height: 844 }),
        };
      if (name === 'react-native-reanimated')
        return {
          default: { View: 'AnimatedView' },
          Easing: { bezier: () => {} },
          useReducedMotion: () => reduced,
          useAnimatedStyle: (fn) => fn(),
          useSharedValue(initial) {
            const index = sharedIndex++;
            return (shared[index] ??= {
              value: initial,
              get() {
                return this.value;
              },
              set(value) {
                this.value = value;
              },
            });
          },
          withTiming: (value) => value,
          interpolate: () => 1,
        };
      if (name === 'react-native-safe-area-context')
        return { useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) };
      if (name === '../state/collection')
        return { useCollection: () => ({ colors: {}, data: { folders: [] } }) };
      if (name === '../utils/item') return { itemUrl: () => '', itemText: () => 'note' };
      if (name === '../utils/context-geometry') return { contextGeometry };
      if (name === '../theme') return { radius: {}, type: {} };
      return {};
    },
  });
  return () => {
    stateIndex = sharedIndex = 0;
    const view = exports.CardContextMenu({
      item: { id: 'one', type: 'note' },
      anchor: { rect: { x: 20, y: 180, width: 160, height: 200 } },
      liftedId: { get: () => 'one' },
    });
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(view);
    const styles = nodes.flatMap((node) => [node.props?.style].flat()).filter(Boolean);
    return {
      nodes,
      styles,
      row: (label) => nodes.find((node) => node.props?.label === label),
      viewport: styles.find((style) => 'height' in style && !('width' in style)),
      preview: styles.find((style) => style.transform?.length === 3),
    };
  };
}

test('folder pages slide forward and back, resize to content, and leave the preview in place', () => {
  for (const reduced of [false, true]) {
    const render = menu(reduced);
    const actions = render();
    const scrolls = actions.nodes.filter((node) => node.type === 'ScrollView');
    scrolls[1].props.onContentSizeChange(320, 147);
    actions.row('Move to folder').props.onPress();
    const folders = render();
    assert.equal(folders.viewport.height, 147);
    assert.equal(
      folders.styles.find(
        (style) => style.transform?.length === 1 && style.transform[0].translateX !== undefined,
      ).transform[0].translateX,
      -320,
    );
    assert.deepEqual(folders.preview, actions.preview);
    folders.row('Back to actions').props.onPress();
    const back = render();
    assert.equal(
      back.styles.find(
        (style) => style.transform?.length === 1 && style.transform[0].translateX !== undefined,
      ).transform[0].translateX,
      -0,
    );
    assert.deepEqual(back.preview, actions.preview);
    assert.ok(back.viewport.height > folders.viewport.height);
  }
});
