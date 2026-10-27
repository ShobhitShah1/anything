import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftItem } from './draft.ts';
const create = (kind, body, title = '', existing) =>
  draftItem(kind, body, title, existing, () => 'new-id');
test('explicit link normalizes domain and rejects executable schemes', () => {
  assert.equal(create('link', 'example.com').url, 'https://example.com/');
  assert.throws(() => create('link', 'javascript:alert(1)'));
});
test('empty draft is rejected and an edited note keeps its identity', () => {
  assert.throws(() => create('note', '  '));
  const original = {
    ...create('note', 'before'),
    id: 'original',
    createdAt: 12,
    isPinned: true,
    tags: ['keep'],
  };
  const changed = create('note', 'after', 'New title', original);
  assert.equal(changed.id, 'original');
  assert.equal(changed.createdAt, 12);
  assert.deepEqual(changed.tags, ['keep']);
  assert.equal(changed.content, 'after');
});
test('checklist retains checked state and image input rejects arbitrary data', () => {
  const original = {
    ...create('checklist', 'one'),
    checklist: [{ id: 'one', text: 'one', completed: true }],
  };
  assert.equal(create('checklist', 'one', '', original).checklist[0].completed, true);
  assert.throws(() => create('image', 'data:text/html;base64,abc'));
});
test('secret value is not used as an automatic title', () => {
  const item = create('secret', 'private-value');
  assert.equal(item.title, 'Secret');
  assert.equal(item.secretValue, 'private-value');
});

test('an editable AI research draft preserves its Markdown, sources, and save identity', () => {
  const content = '# Weeknight pasta\n\n- Tomato pasta\n\n## Sources\nhttps://example.com/recipe';
  const first = create('markdown', content, 'Weeknight pasta');
  const edited = create('markdown', `${content}\n\nUse less salt.`, first.title, first);
  assert.equal(edited.type, 'markdown');
  assert.equal(edited.id, first.id);
  assert.equal(edited.title, 'Weeknight pasta');
  assert.equal(edited.content, `${content}\n\nUse less salt.`);
});
