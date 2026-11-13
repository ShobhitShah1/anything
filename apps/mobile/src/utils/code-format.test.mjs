import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codePreviewMarkdown, hasSupportedCodeExtension, languageFromPath } from './code-format.ts';

test('file extensions select the code language', () => {
  assert.equal(languageFromPath('src/Widget.tsx'), 'tsx');
  assert.equal(languageFromPath('scripts/setup.sh'), 'bash');
  assert.equal(languageFromPath('README.unknown'), 'text');
  assert.equal(hasSupportedCodeExtension('snippet.ts'), true);
  assert.equal(hasSupportedCodeExtension('README.unknown'), false);
  assert.equal(hasSupportedCodeExtension('no-extension'), false);
});

test('code preview fences keep embedded Markdown fences inside the code block', () => {
  assert.equal(
    codePreviewMarkdown('typescript', 'const n = 1;'),
    '```typescript\nconst n = 1;\n```',
  );
  assert.equal(
    codePreviewMarkdown('markdown', '```js\nalert(1)\n```'),
    '````markdown\n```js\nalert(1)\n```\n````',
  );
  assert.equal(codePreviewMarkdown('js\n```\n# injected', 'alert(1)'), '```text\nalert(1)\n```');
});
