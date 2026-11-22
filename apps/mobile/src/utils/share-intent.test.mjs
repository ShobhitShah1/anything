import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function transpileAndRun(relativePath, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;

  runInNewContext(source, {
    exports,
    Buffer: globalThis.Buffer,
    Promise,
    Date,
    URL,
    Set,
    Map,
    RegExp,
    console,
    Boolean,
    Array,
    Object,
    String,
    Number,
    require(name) {
      if (mocks[name]) return mocks[name];
      throw new Error(`Unexpected import in ${relativePath}: ${name}`);
    },
  });

  return exports;
}

function loadShareIntentService({ fileStorage = {}, hapticCalls = [] } = {}) {
  const codeFormat = transpileAndRun('./code-format.ts', {});
  const itemTitle = transpileAndRun('../shared/utils/itemTitle.ts', {});
  const fetchPreview = transpileAndRun('../shared/utils/fetchPreview.ts', {});
  const storage = transpileAndRun('../shared/utils/storage.ts', {});
  const clipboard = transpileAndRun('../shared/utils/clipboard.ts', {
    './fetchPreview.ts': fetchPreview,
    './itemTitle': itemTitle,
    './storage.ts': storage,
  });
  const quickCapture = transpileAndRun('../shared/utils/quickCapture.ts', {
    'expo-crypto': { randomUUID: () => 'qc-uuid' },
    './itemTitle': itemTitle,
    './clipboard.ts': clipboard,
    './fetchPreview.ts': fetchPreview,
    './storage.ts': storage,
  });
  const draft = transpileAndRun('./draft.ts', {
    '../shared/utils/fetchPreview.ts': fetchPreview,
    '../shared/utils/itemTitle.ts': itemTitle,
  });

  const service = transpileAndRun('../services/share-intent.ts', {
    'expo-haptics': {
      NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
      notificationAsync: async (type) => {
        hapticCalls.push(type);
      },
    },
    'expo-file-system/legacy': {
      EncodingType: { Base64: 'base64', UTF8: 'utf8' },
      readAsStringAsync: async (path, options) => {
        const cleanPath = path.replace(/^file:\/\//, '');
        if (fileStorage[cleanPath] !== undefined) return fileStorage[cleanPath];
        if (fileStorage[path] !== undefined) return fileStorage[path];
        throw new Error(`File not found: ${path}`);
      },
    },
    'expo-crypto': {
      randomUUID: () => 'service-uuid',
    },
    '../shared/utils/quickCapture.ts': quickCapture,
    '../shared/utils/clipboard.ts': clipboard,
    '../utils/draft.ts': draft,
    '../utils/code-format.ts': codeFormat,
  });

  return { ...service, quickCapture };
}

function createMockContext(initialItems = [], quickCapture) {
  const saved = [];
  let currentNotice = '';
  let currentError = '';

  const context = {
    items: [...initialItems],
    save: async (item) => {
      saved.push(item);
      context.items.unshift(item);
    },
    capture: async (text) => {
      const res = quickCapture.createQuickCaptures(text, context.items);
      for (const item of res.items) {
        saved.push(item);
        context.items.unshift(item);
      }
    },
    enrich: () => {},
    setNotice: (msg) => {
      currentNotice = msg;
    },
    setError: (msg) => {
      currentError = msg;
    },
  };

  return {
    context,
    saved,
    getNotice: () => currentNotice,
    getError: () => currentError,
  };
}

test('processes webUrl share intent and saves link with notice and returns savedId', async () => {
  const { processShareIntent, quickCapture } = loadShareIntentService();
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'weburl',
      webUrl: 'https://example.com/article',
      text: null,
      files: null,
      meta: { title: 'Interesting Article' },
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'link');
  assert.equal(saved[0].url, 'https://example.com/article');
  assert.equal(saved[0].title, 'Interesting Article');
  assert.equal(getNotice(), 'Saved to your collection');
});

test('detects duplicate shared link, sets notice and returns duplicate savedId', async () => {
  const { processShareIntent, quickCapture } = loadShareIntentService();
  const existingItem = {
    id: 'existing-1',
    type: 'link',
    url: 'https://example.com/already-here',
    domain: 'example.com',
    title: 'Old Title',
    createdAt: 1000,
    isPinned: false,
    tags: [],
  };
  const { context, saved, getNotice } = createMockContext([existingItem], quickCapture);

  const result = await processShareIntent(
    {
      type: 'weburl',
      webUrl: 'https://example.com/already-here',
      text: null,
      files: null,
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 0);
  assert.equal(result.savedId, 'existing-1');
  assert.equal(getNotice(), 'Already in your collection');
});

test('processes social media post URLs (X / Twitter) and returns savedId', async () => {
  const { processShareIntent, quickCapture } = loadShareIntentService();
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'weburl',
      webUrl: 'https://x.com/jack/status/20',
      text: null,
      files: null,
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'x_post');
  assert.equal(saved[0].postUrl, 'https://x.com/jack/status/20');
  assert.equal(getNotice(), 'Saved to your collection');
});

test('processes plain text share as note and returns savedId', async () => {
  const { processShareIntent, quickCapture } = loadShareIntentService();
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'text',
      webUrl: null,
      text: 'Remember to pick up the dry cleaning tomorrow morning.',
      files: null,
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'note');
  assert.equal(saved[0].content, 'Remember to pick up the dry cleaning tomorrow morning.');
  assert.equal(getNotice(), 'Saved to your collection');
});

test('processes markdown text share as markdown item and returns savedId', async () => {
  const { processShareIntent, quickCapture } = loadShareIntentService();
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'text',
      webUrl: null,
      text: '# Meeting Notes\n\n- Discuss architecture\n- Review timelines',
      files: null,
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'markdown');
  assert.equal(saved[0].title, 'Meeting Notes');
  assert.equal(getNotice(), 'Saved to your collection');
});

test('processes code snippet share as code item and returns savedId', async () => {
  const { processShareIntent, quickCapture } = loadShareIntentService();
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const codeSnippet = 'const add = (a: number, b: number): number => a + b;';
  const result = await processShareIntent(
    {
      type: 'text',
      webUrl: null,
      text: codeSnippet,
      files: null,
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'code');
  assert.equal(saved[0].code, codeSnippet);
  assert.equal(getNotice(), 'Saved to your collection');
});

test('processes single image file, saves ImageItem and returns savedId', async () => {
  const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const fileStorage = {
    '/data/user/0/cache/sample.png': fakeBase64,
  };
  const { processShareIntent, quickCapture } = loadShareIntentService({ fileStorage });
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'media',
      webUrl: null,
      text: 'A scenic mountain photo',
      files: [
        {
          path: '/data/user/0/cache/sample.png',
          fileName: 'mountain.png',
          mimeType: 'image/png',
          width: 800,
          height: 600,
          size: 1024,
          duration: null,
        },
      ],
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'image');
  assert.equal(saved[0].imageUrl, `data:image/png;base64,${fakeBase64}`);
  assert.equal(saved[0].mediaAspectRatio, 800 / 600);
  assert.equal(saved[0].caption, 'A scenic mountain photo');
  assert.equal(saved[0].title, 'mountain');
  assert.equal(getNotice(), 'Saved image to your collection');
});

test('processes multiple images with cover, additionalImages and returns savedId', async () => {
  const base64Img1 = 'img1-data';
  const base64Img2 = 'img2-data';
  const fileStorage = {
    '/cache/photo1.jpg': base64Img1,
    '/cache/photo2.jpg': base64Img2,
  };
  const { processShareIntent, quickCapture } = loadShareIntentService({ fileStorage });
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'media',
      webUrl: null,
      text: null,
      files: [
        {
          path: '/cache/photo1.jpg',
          fileName: 'photo1.jpg',
          mimeType: 'image/jpeg',
          width: 1000,
          height: 1000,
          size: 2048,
          duration: null,
        },
        {
          path: '/cache/photo2.jpg',
          fileName: 'photo2.jpg',
          mimeType: 'image/jpeg',
          width: 1200,
          height: 800,
          size: 3000,
          duration: null,
        },
      ],
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'image');
  assert.equal(saved[0].imageUrl, `data:image/jpeg;base64,${base64Img1}`);
  assert.equal(saved[0].mediaAspectRatio, 1);
  assert.equal(saved[0].additionalImages?.length, 1);
  assert.equal(saved[0].additionalImages[0].url, `data:image/jpeg;base64,${base64Img2}`);
  assert.equal(saved[0].additionalImages[0].aspectRatio, 1200 / 800);
  assert.equal(getNotice(), 'Saved 2 images');
});

test('processes shared markdown file (.md) as markdown item and returns savedId', async () => {
  const mdContent = '# Project Roadmap\n\n- Phase 1: MVP\n- Phase 2: Launch';
  const fileStorage = {
    '/docs/roadmap.md': mdContent,
  };
  const { processShareIntent, quickCapture } = loadShareIntentService({ fileStorage });
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'file',
      webUrl: null,
      text: null,
      files: [
        {
          path: '/docs/roadmap.md',
          fileName: 'roadmap.md',
          mimeType: 'text/markdown',
          width: null,
          height: null,
          size: 100,
          duration: null,
        },
      ],
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'markdown');
  assert.equal(saved[0].title, 'roadmap');
  assert.equal(saved[0].content, mdContent);
  assert.equal(getNotice(), 'Saved roadmap.md to your collection');
});

test('processes shared code file (.ts) as code item with correct language and returns savedId', async () => {
  const tsContent = 'export function hello(name: string) { return `Hello ${name}`; }';
  const fileStorage = {
    '/src/hello.ts': tsContent,
  };
  const { processShareIntent, quickCapture } = loadShareIntentService({ fileStorage });
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: 'file',
      webUrl: null,
      text: null,
      files: [
        {
          path: '/src/hello.ts',
          fileName: 'hello.ts',
          mimeType: 'text/plain',
          width: null,
          height: null,
          size: 200,
          duration: null,
        },
      ],
    },
    context,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  assert.equal(result.savedId, saved[0].id);
  assert.equal(saved[0].type, 'code');
  assert.equal(saved[0].title, 'hello.ts');
  assert.equal(saved[0].language, 'typescript');
  assert.equal(saved[0].code, tsContent);
  assert.equal(saved[0].files?.[0].path, 'hello.ts');
  assert.equal(getNotice(), 'Saved hello.ts to your collection');
});

test('empty or invalid share intent returns success false without savedId', async () => {
  const { processShareIntent, quickCapture } = loadShareIntentService();
  const { context, saved, getNotice } = createMockContext([], quickCapture);

  const result = await processShareIntent(
    {
      type: null,
      webUrl: null,
      text: null,
      files: null,
    },
    context,
  );

  assert.equal(result.success, false);
  assert.equal(result.savedId, undefined);
  assert.equal(saved.length, 0);
  assert.equal(getNotice(), '');
});
