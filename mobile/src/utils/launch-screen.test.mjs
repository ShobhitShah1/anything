import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import config from '../../app.config.ts';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(
  readFileSync(new URL('../components/launch-screen.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

function startup(reduced = false, native = false) {
  const collection = { ready: false, error: '' };
  const states = [],
    exports = {};
  const shared = [],
    effects = [],
    animations = [];
  let cursor = 0,
    hides = 0,
    effectCursor = 0,
    sharedCursor = 0;
  let finishNative;
  runInNewContext(source, {
    exports,
    __DEV__: true,
    console: { warn() {} },
    require(name) {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react')
        return {
          useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = initial;
            return [
              states[index],
              (value) => {
                states[index] = value;
              },
            ];
          },
          useEffect(effect, next) {
            const index = effectCursor++;
            const previous = effects[index];
            if (!previous || next.some((value, index) => previous.next[index] !== value)) {
              previous?.cleanup?.();
              effects[index] = { next, cleanup: effect() };
            }
          },
        };
      if (name === 'react-native')
        return {
          Platform: { OS: 'android' },
          View: 'View',
          Image: 'Image',
          StyleSheet: { absoluteFill: { position: 'absolute', inset: 0 } },
        };
      if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
      if (name === '../../modules/anything-launch')
        return {
          __esModule: true,
          default: native
            ? {
                hide: () => {
                  hides++;
                  return new Promise((resolve) => {
                    finishNative = resolve;
                  });
                },
              }
            : null,
        };
      if (name === 'react-native-reanimated')
        return {
          __esModule: true,
          default: { View: 'AnimatedView', Image: 'AnimatedImage' },
          Easing: { bezier: () => undefined },
          cancelAnimation: () => {},
          useAnimatedStyle: (fn) => fn(),
          useReducedMotion: () => reduced,
          useSharedValue(initial) {
            const index = sharedCursor++;
            return (shared[index] ??= {
              value: initial,
              get() {
                return this.value;
              },
              set(animation) {
                animations.push({ ...animation, shared: this });
              },
            });
          },
          withTiming: (target, config, callback) => ({ target, config, callback }),
        };
      if (name === 'react-native-worklets') return { scheduleOnRN: (fn, ...args) => fn(...args) };
      if (name.endsWith('icon-ios-dark.png')) return 2;
      if (name === '../state/collection') return { useCollection: () => collection };
      if (name.endsWith('splash-art.png')) return 1;
      throw new Error(name);
    },
  });
  return {
    collection,
    animations,
    finishNative: () => finishNative(),
    finishAnimation(finished = true) {
      const animation = animations.shift();
      assert.ok(animation, 'expected a running startup animation');
      if (finished) animation.shared.value = animation.target;
      animation.callback(finished);
    },
    get hides() {
      return hides;
    },
    render() {
      cursor = effectCursor = sharedCursor = 0;
      const view = exports.LaunchScreen({ children: 'Routes' });
      const [content, art] = view.props.children;
      return {
        content,
        art,
        image: art && art.props.children.find((child) => child.type === 'AnimatedImage'),
      };
    },
  };
}

test('fallback artwork starts only after loading and layout, then stays until the content is ready', async () => {
  const boot = startup();
  let frame = boot.render();
  assert.equal(frame.content, false);
  assert.equal(frame.image.props.resizeMode, 'cover');
  assert.equal(frame.image.props.style[1].width, '100%');
  assert.equal(frame.image.props.style[1].height, '100%');
  frame.art.props.onLayout();
  frame = boot.render();
  assert.equal(boot.hides, 0);
  frame.image.props.onLoad();
  boot.render();
  await new Promise(setImmediate);
  assert.equal(boot.hides, 0);
  assert.ok(boot.render().art);
  boot.finishAnimation();
  boot.render();
  boot.collection.ready = true;
  frame = boot.render();
  assert.ok(frame.art);
  frame.content.props.onLayout();
  assert.ok(boot.render().art);
  boot.finishAnimation();
  assert.equal(boot.render().art, false);
});

test('startup releases to a laid-out recovery screen even if hydration or artwork fails', async () => {
  const boot = startup();
  const initial = boot.render();
  initial.art.props.onLayout();
  initial.image.props.onError();
  boot.render();
  await new Promise(setImmediate);
  boot.render();
  boot.finishAnimation();
  boot.collection.error = 'Could not load collection';
  const frame = boot.render();
  assert.ok(frame.content);
  frame.content.props.onLayout();
  assert.ok(boot.render().art);
  boot.finishAnimation();
  assert.equal(boot.render().art, false);
});

test('fast hydration cannot skip the visible intro or unmount artwork before its fade ends', async () => {
  const boot = startup();
  boot.collection.ready = true;
  let frame = boot.render();
  frame.content.props.onLayout();
  frame.art.props.onLayout();
  frame.image.props.onLoad();
  boot.render();
  await new Promise(setImmediate);
  frame = boot.render();
  assert.ok(frame.art);
  assert.equal(frame.content.props.pointerEvents, 'none');
  assert.equal(boot.animations.length, 1);
  boot.finishAnimation();
  frame = boot.render();
  assert.ok(frame.art, 'bitmap remains mounted throughout the exit animation');
  boot.finishAnimation();
  frame = boot.render();
  assert.equal(frame.art, false);
  assert.equal(frame.content.props.pointerEvents, 'auto');
});

test('reduced motion skips zoom and animation duration', async () => {
  const boot = startup(true);
  boot.collection.ready = true;
  let frame = boot.render();
  assert.equal(frame.image.props.style[2].transform.length, 0);
  frame.content.props.onLayout();
  frame.art.props.onLayout();
  frame.image.props.onLoad();
  boot.render();
  await new Promise(setImmediate);
  boot.render();
  assert.equal(boot.animations[0].config.duration, 0);
  boot.finishAnimation();
  boot.render();
  assert.equal(boot.animations[0].config.duration, 0);
  boot.finishAnimation();
  assert.equal(boot.render().art, false);
});

test('custom Android artwork stays native until the content has laid out and native fade finishes', async () => {
  const boot = startup(false, true);
  let frame = boot.render();
  assert.equal(frame.art, false);
  assert.equal(frame.content, false);
  assert.equal(boot.hides, 0);
  boot.collection.ready = true;
  frame = boot.render();
  assert.equal(boot.hides, 0);
  frame.content.props.onLayout();
  frame = boot.render();
  assert.equal(boot.hides, 1);
  assert.equal(frame.content.props.pointerEvents, 'none');
  boot.finishNative();
  await new Promise(setImmediate);
  assert.equal(boot.render().content.props.pointerEvents, 'auto');
});

test('launch config removes Expo SplashScreen and packages the approved artwork in the Android module', () => {
  assert.ok(config.plugins.includes('./plugins/with-android-launch.cjs'));
  assert.ok(
    !config.plugins.some(
      (entry) => (Array.isArray(entry) ? entry[0] : entry) === 'expo-splash-screen',
    ),
  );
  const png = readFileSync(new URL('../../assets/splash-art.png', import.meta.url));
  const native = readFileSync(
    new URL(
      '../../modules/anything-launch/android/src/main/res/drawable-nodpi/anything_launch_art.png',
      import.meta.url,
    ),
  );
  assert.ok(png.equals(native));
  const vector = readFileSync(new URL('../../assets/splash-art.svg', import.meta.url), 'utf8');
  assert.ok(!vector.includes('<text'), 'splash artwork contains no text');
  assert.match(vector, /#0d0d0f/);
});
