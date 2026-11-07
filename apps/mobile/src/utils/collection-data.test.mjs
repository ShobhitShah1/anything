import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyCollection,
  mergeQueuedCollection,
  removeCollectionItems,
  validateCollection,
} from './collection-data.ts';
const note = (id, content = id) => ({
  id,
  type: 'note',
  title: id,
  content,
  createdAt: 1,
  isPinned: false,
  tags: [],
});
const collection = (...items) => ({ items, folders: [] });

test('dark is the default while explicitly saved appearance preferences are preserved', () => {
  assert.equal(emptyCollection.theme, 'dark');
  assert.equal(validateCollection(collection()).theme, 'dark');
  for (const theme of ['light', 'dark', 'system'])
    assert.equal(validateCollection({ ...collection(), theme }).theme, theme);
});
test('hydrates valid saves and refuses invalid records and journals', () => {
  assert.equal(validateCollection({ ...emptyCollection, items: [note('a')] }).items.length, 1);
  assert.throws(() => validateCollection({ items: [{ id: 'bad' }], folders: [] }));
  assert.throws(() =>
    validateCollection({ ...emptyCollection, journals: { user: { pending: [{}] } } }),
  );
});
test('queued cloud snapshot preserves newer local additions, edits and deletions', () => {
  const result = mergeQueuedCollection(
    collection(note('a'), note('deleted')),
    collection(note('a', 'local edit'), note('new')),
    collection(note('a', 'cloud'), note('deleted'), note('remote')),
  );
  assert.deepEqual(new Set(result.items.map((item) => item.id)), new Set(['a', 'new', 'remote']));
  assert.equal(result.items.find((item) => item.id === 'a').content, 'local edit');
});
test('unchanged local data accepts newer cloud fields', () => {
  const before = collection(note('a'));
  assert.equal(
    mergeQueuedCollection(before, before, collection(note('a', 'updated'))).items[0].content,
    'updated',
  );
});

test('batch removal deletes only selected IDs in one immutable collection update', () => {
  const original = { ...emptyCollection, items: [note('a'), note('b'), note('c'), note('d')] };
  const result = removeCollectionItems(original, ['b', 'd', 'b', 'missing']);
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['a', 'c'],
  );
  assert.equal(result.items[0], original.items[0]);
  assert.equal(result.folders, original.folders);
  assert.equal(result.journals, original.journals);
  assert.equal(original.items.length, 4);
  assert.deepEqual(removeCollectionItems(original, []).items, original.items);
  assert.deepEqual(removeCollectionItems(original, ['a', 'b', 'c', 'd']).items, []);
});
