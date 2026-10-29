import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { subscriptionPlans } from './subscription-plans.ts';

const source = ts.transpileModule(
  readFileSync(new URL('../app/subscription.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

function render({
  loading = false,
  working = false,
  openPolicy = () => {},
  development = false,
  preview = false,
} = {}) {
  const exports = {};
  let stateIndex = 0;
  const snapshot = {
    access: { paid: false, remaining: 3 },
    customer: { entitlements: { active: {} } },
    plans: [
      { identifier: '$rc_monthly', product: { subscriptionPeriod: 'P1M', priceString: '₹99' } },
    ],
  };
  const jsx = (type, props) => ({ type, props });
  runInNewContext(source, {
    exports,
    process: { env: {} },
    __DEV__: development,
    require(name) {
      if (name === 'react')
        return {
          useCallback: (fn) => fn,
          useEffect: () => {},
          useRef: (current) => ({ current }),
          useState(initial) {
            const index = stateIndex++;
            return [index === 4 ? loading : index === 5 ? working : initial, () => {}];
          },
        };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-native')
        return {
          useWindowDimensions: () => ({ width: 320, height: 800 }),
          Image: 'Artwork',
          ActivityIndicator: 'Spinner',
          Pressable: 'Button',
          ScrollView: 'Scroll',
          Text: 'Text',
          View: 'View',
        };
      if (name === 'expo-router') return { Stack: { Screen: 'Screen' }, useFocusEffect: () => {} };
      if (name === 'react-native-safe-area-context')
        return { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) };
      if (name === '../state/collection')
        return {
          useCollection: () => ({
            colors: {},
            user: { uid: 'one' },
            busy: false,
            devPro: preview,
            setDevPro: () => {},
          }),
        };
      if (name === '../services/subscription') return { subscriptionSnapshot: () => snapshot };
      if (name === '../services/billing') return { REVENUECAT_TEST_MODE: false };
      if (name === '../utils/billing-config')
        return { ENTITLEMENT_ID: 'anything_pro', hasPro: () => false };
      if (name === '../utils/subscription-plans') return { subscriptionPlans };
      if (name === '../utils/open-link') return { openLink: async (url) => openPolicy(url) };
      if (name === '../components/membership-backdrop') return { MembershipBackdrop: 'Gradient' };
      if (name === '../theme') return { fonts: {} };
      return {};
    },
  });
  const wrapper = exports.default();
  const nodes = [];
  function visit(node, ancestors = []) {
    if (Array.isArray(node)) return node.forEach((child) => visit(child, ancestors));
    if (!node || typeof node !== 'object') return;
    nodes.push({ node, ancestors });
    visit(node.props?.children, [...ancestors, node]);
  }
  visit(wrapper.type(wrapper.props));
  return nodes;
}

test('cached plans stay visible and loading stays inside the purchase button', () => {
  for (const mode of [{}, { working: true }, { loading: true }]) {
    const nodes = render(mode);
    assert.equal(nodes.filter(({ node }) => node.props.accessibilityRole === 'radio').length, 1);
    const spinners = nodes.filter(({ node }) => node.type === 'Spinner');
    assert.equal(spinners.length, mode.working || mode.loading ? 1 : 0);
    assert.ok(
      spinners.every(({ ancestors }) =>
        ancestors.some((node) => node.props.accessibilityLabel === 'Subscribe to Monthly'),
      ),
    );
    const links = nodes.filter(({ node }) => node.props.accessibilityRole === 'link');
    assert.equal(links.length, 2);
    assert.deepEqual(
      links.map(({ node }) => node.props.accessibilityLabel),
      ['Terms and conditions', 'Privacy policy'],
    );
    assert.ok(
      !nodes.some(({ node }) =>
        String(node.props.children).includes('Use your free responses first'),
      ),
    );
  }
});

test('development preview shows the subscribed layout without exposing a checkout action', () => {
  const nodes = render({ development: true, preview: true });
  assert.ok(nodes.some(({ node }) => node.props.accessibilityLabel === 'Back to collection'));
  assert.ok(
    nodes.some(
      ({ node }) =>
        node.props.accessibilityRole === 'progressbar' && node.props.accessibilityValue.now === 100,
    ),
  );
  assert.ok(!nodes.some(({ node }) => node.props.accessibilityRole === 'radio'));
  assert.ok(
    nodes.find(({ node }) => node.props.accessibilityLabel === 'Restore purchases').node.props
      .disabled,
  );
});

test('preview controls and preview state are ignored in production', () => {
  const production = render({ development: false, preview: true });
  assert.ok(!production.some(({ node }) => /preview/i.test(node.props.accessibilityLabel || '')));
  assert.equal(production.filter(({ node }) => node.props.accessibilityRole === 'radio').length, 1);
  const development = render({ development: true });
  assert.ok(
    !development.some(({ node }) => node.props.accessibilityLabel === 'Enable Pro for my profile'),
  );
  assert.ok(
    !development.some(({ node }) => String(node.props.children).includes('YOUR MEMBERSHIP')),
  );
});

test('purchase screen shows the allowance and selectable plans without a fabricated example', () => {
  const nodes = render();
  const texts = nodes
    .filter(({ node }) => node.type === 'Text')
    .map(({ node }) => node.props.children);
  assert.ok(texts.includes('A space for'));
  assert.ok(nodes.some(({ node }) => node.type === 'Artwork'));
  assert.ok(texts.includes('AI responses'));
  assert.ok(!texts.includes('A draft with Pro · example'));
  assert.ok(!texts.includes('Write & refine'));
  const plans = nodes.find(({ node }) => node.props.accessibilityRole === 'radiogroup').node;
  assert.equal(plans.props.style.flexDirection, 'row');
});

test('policy links open the public pages and the gradient and fixed typography remain', () => {
  const opened = [];
  const nodes = render({ openPolicy: (url) => opened.push(url) });
  for (const { node } of nodes.filter(({ node }) => node.props.accessibilityRole === 'link'))
    node.props.onPress();
  assert.deepEqual(opened, [
    'https://shobhitshah1.github.io/anything/about/terms.html',
    'https://shobhitshah1.github.io/anything/about/privacy.html',
  ]);
  assert.equal(nodes.filter(({ node }) => node.type === 'Gradient').length, 1);
  assert.ok(
    nodes
      .filter(({ node }) => node.type === 'Text')
      .every(({ node }) => node.props.allowFontScaling === false),
  );
});
