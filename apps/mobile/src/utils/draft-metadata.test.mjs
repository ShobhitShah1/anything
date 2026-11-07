import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftItem } from './draft.ts';
const create = (kind, body, existing) => draftItem(kind, body, 'Updated', existing, () => 'id');
test('editing imported images and checklists retains their existing metadata', () => {
  const image = {
    ...create('image', 'https://example.com/image.jpg'),
    caption: 'Keep this caption',
    mediaAspectRatio: 1.5,
  };
  assert.equal(create('image', image.imageUrl, image).caption, image.caption);
  assert.equal(create('image', image.imageUrl, image).mediaAspectRatio, 1.5);
  const note = { ...create('checklist', 'First'), content: 'Intro text' };
  assert.equal(create('checklist', 'First', note).content, 'Intro text');
});
