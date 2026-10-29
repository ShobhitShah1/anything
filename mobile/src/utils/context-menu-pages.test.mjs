import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { contextGeometry } from './context-geometry.ts';
import { contextMenuPhase } from './context-menu-state.ts';

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
    refs = [],
    effects = [],
    shared = [],
    exports = {};
  let stateIndex = 0,
    refIndex = 0,
    sharedIndex = 0;
  let phase = 'open';
  let readyCalls = 0;
  const liftedId = {
    value: 'one',
    get() {
      return this.value;
    },
    set(value) {
      this.value = value;
    },
  };
  runInNewContext(source, {
    exports,
    setTimeout: () => 0,
    clearTimeout: () => {},
    require(name) {
      if (name === 'react')
        return {
          useCallback: (fn) => fn,
          useEffect: (effect) => effects.push(effect),
          useRef: (current) => (refs[refIndex++] ??= { current }),
          useReducer: () => [
            phase,
            (event) => {
              phase = contextMenuPhase(phase, event);
            },
          ],
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
          withSpring: (value, _, finished) => {
            finished?.(true);
            return value;
          },
          interpolate: () => 1,
        };
      if (name === 'react-native-worklets') return { scheduleOnRN: (fn) => fn() };
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
  return ({ ready = true, lifted = liftedId.value } = {}) => {
    stateIndex = refIndex = sharedIndex = 0;
    effects.length = 0;
    liftedId.value = lifted;
    const view = exports.CardContextMenu({
      item: { id: 'one', type: 'note' },
      anchor: { rect: { x: 20, y: 180, width: 160, height: 200 } },
      ready,
      liftedId,
      onReady: () => {
        readyCalls++;
      },
      onClose: () => {},
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
      readyCalls,
      flushEffects: () => effects.forEach((effect) => effect()),
    };
  };
}

test('first-open handoff waits for both modal visibility and image readiness, in either order', () => {
  for (const imageFirst of [false, true]) {
    const render = menu();
    let view = render({ ready: false, lifted: null });
    const imageReady = view.nodes.find((node) => node.props?.onPreviewReady).props.onPreviewReady;
    const shown = view.nodes.find((node) => node.type === 'Modal').props.onShow;
    (imageFirst ? imageReady : shown)();
    view = render({ ready: false });
    view.flushEffects();
    assert.equal(render().readyCalls, 0);
    (imageFirst ? shown : imageReady)();
    view = render({ ready: false });
    view.flushEffects();
    assert.equal(render().readyCalls, 1);
  }
});

test('closing before the modal shows prevents late readiness from lifting the source', () => {
  const render = menu();
  let view = render({ ready: false, lifted: null });
  const modal = view.nodes.find((node) => node.type === 'Modal');
  modal.props.onRequestClose();
  modal.props.onShow();
  view.nodes.find((node) => node.props?.onPreviewReady).props.onPreviewReady();
  view = render({ ready: false });
  view.flushEffects();
  assert.equal(render().readyCalls, 0);
});

test('preview keeps its layout and shares source visibility, and dismissal hides the native modal', () => {
  for (const reduced of [false, true]) {
    for (const ready of [false, true]) {
      for (let cycle = 0; cycle < 3; cycle++) {
        const render = menu(reduced);
        const loading = render({ ready: false, lifted: null });
        assert.equal(loading.preview.opacity, 0);
        assert.equal(loading.preview.display, undefined);
        // Source and preview must swap on the same UI-thread value, before React commits ready.
        assert.equal(render({ ready: false, lifted: 'one' }).preview.opacity, 1);
        assert.equal(render({ lifted: null }).preview.opacity, 0);
        const open = render({ ready, lifted: 'one' });
        assert.equal(open.preview.opacity, 1);
        assert.equal(open.preview.display, undefined);
        const modal = open.nodes.find((node) => node.type === 'Modal');
        assert.equal(modal.props.visible, true);
        modal.props.onRequestClose();
        const closed = render();
        assert.equal(closed.nodes.find((node) => node.type === 'Modal').props.visible, false);
        assert.equal(closed.preview, undefined);
      }
    }
  }
});

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
