import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { cardWidths } from './card-widths.ts';
import { itemImage, itemText, typeLabel } from './item.ts';
import { getItemTitle } from '../shared/utils/itemTitle.ts';

const colors = {
  ink: '#eee',
  muted: '#aaa',
  paper: '#181818',
  soft: '#222',
  canvas: '#111',
  line: '#444',
  accent: '#ccc',
};
const jsx = (type, props) => ({ type, props });
const react = {
  memo: (fn) => fn,
  useRef: () => ({ current: null }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
};

function load(component) {
  const exports = {};
  const source = ts.transpileModule(
    readFileSync(new URL(`../components/${component}.tsx`, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable' };
      if (name === 'react-native-enriched-markdown')
        return { EnrichedMarkdownText: 'NativeMarkdown' };
      if (name === 'react-native-reanimated') return { useReducedMotion: () => false };
      if (name === 'react-native-fast-image') return { __esModule: true, default: 'Image' };
      if (name === 'lucide-react-native') return new Proxy({}, { get: (_, key) => key });
      if (name === 'expo-router') return { router: { push: () => {} } };
      if (name === '../state/collection')
        return { useCollection: () => ({ colors, dark: true, setError: () => {} }) };
      if (name === '../theme')
        return {
          fonts: { editorial: 'serif', mono: 'monospace' },
          radius: {},
          type: { caption: {} },
        };
      if (name === '../utils/open-link') return { openLink: async () => {} };
      if (name === '../utils/card-widths') return { cardWidths };
      if (name === '../utils/item') return { itemImage, itemText, typeLabel };
      if (name === '../shared/utils/itemTitle') return { getItemTitle };
      if (name === './markdown-content') return { MarkdownContent: 'MarkdownContent' };
      if (name === './collection-motion')
        return { CardFrame: 'CardFrame', MotionPosition: 'MotionPosition' };
      if (name === './adaptive-image') return { AdaptiveImage: 'AdaptiveImage' };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return exports;
}

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}

const markdown =
  '# A saved guide\n\n**Bold** and _italic_.\n\n- A list item\n\n> A quote\n\n| A | B |\n| --- | --- |\n| one | two |';
const item = {
  id: 'guide',
  type: 'markdown',
  title: 'A saved guide',
  content: markdown,
  tags: [],
  isPinned: false,
  createdAt: 0,
};

test('grid and list cards send Markdown to the native renderer instead of a raw Text excerpt', () => {
  const { SaveCard } = load('save-card');
  for (const list of [false, true]) {
    const tree = nodes(SaveCard({ item, width: list ? 320 : 180, list, onMenu: () => {} }));
    const preview = tree.find((node) => node.type === 'MarkdownContent');
    assert.ok(preview);
    assert.equal(preview.props.text, markdown);
    assert.equal(preview.props.previewLines, list ? 3 : 6);
    assert.ok(!tree.some((node) => node.type === 'Text' && node.props.children === markdown));
    assert.ok(!tree.some((node) => node.type === 'Text' && node.props.children === item.title));
  }
});

test('plain notes keep their text and Markdown without a heading retains its separate title', () => {
  const { SaveCard } = load('save-card');
  const note = nodes(
    SaveCard({
      item: { ...item, type: 'note', content: 'A plain thought' },
      width: 180,
      onMenu: () => {},
    }),
  );
  assert.ok(note.some((node) => node.type === 'Text' && node.props.children === 'A plain thought'));
  assert.ok(!note.some((node) => node.type === 'MarkdownContent'));
  const guide = nodes(
    SaveCard({ item: { ...item, content: '**A short guide**' }, width: 180, onMenu: () => {} }),
  );
  assert.ok(guide.some((node) => node.type === 'Text' && node.props.children === item.title));
});

test('previews are bounded and non-interactive while full Markdown retains reading and link behavior', () => {
  const { MarkdownContent } = load('markdown-content');
  const preview = MarkdownContent({ text: markdown, previewLines: 3 });
  assert.equal(preview.props.pointerEvents, 'none');
  assert.equal(preview.props.style.maxHeight, 60);
  assert.equal(preview.props.style.overflow, 'hidden');
  const native = preview.props.children;
  assert.equal(native.type, 'NativeMarkdown');
  assert.equal(native.props.markdown, markdown);
  assert.equal(native.props.flavor, 'github');
  assert.equal(native.props.allowFontScaling, false);
  assert.equal(native.props.selectable, false);
  assert.equal(native.props.onLinkPress, undefined);
  assert.equal(native.props.markdownStyle.h1.fontSize, 18);
  const full = MarkdownContent({ text: markdown });
  assert.equal(full.type, 'NativeMarkdown');
  assert.equal(full.props.selectable, true);
  assert.equal(full.props.allowFontScaling, false);
  assert.equal(typeof full.props.onLinkPress, 'function');
  assert.equal(full.props.markdownStyle.h1.fontSize, 28);
});
