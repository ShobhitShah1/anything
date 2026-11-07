import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from './backup.ts';

const note = {
  id: 'note-1',
  type: 'note',
  title: 'A thought',
  content: 'Keep this',
  createdAt: 1,
  isPinned: false,
  tags: [],
};
test('backup import accepts exported JSON and a UTF-8 BOM from file providers', () => {
  assert.deepEqual(parseBackup(JSON.stringify([note])), [note]);
  assert.deepEqual(parseBackup('\uFEFF' + JSON.stringify([note])), [note]);
  assert.deepEqual(parseBackup('[]'), []);
});
test('backup import rejects unrelated files and invalid saves before any collection update', () => {
  for (const text of [
    'not json',
    '{}',
    '[null]',
    '[{"id":"broken"}]',
    JSON.stringify(Array(10001).fill(note)),
  ]) {
    assert.throws(() => parseBackup(text), /collection is unchanged/);
  }
  assert.throws(() => parseBackup(' '.repeat(15_000_001)), /smaller than 15 MB/);
});
