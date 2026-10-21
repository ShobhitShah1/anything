import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getItemTitle } from './itemTitle.ts';

test('link titles keep personal names and display the real host instead of a raw URL', () => {
  const url = 'https://www.figma.com/design/example/Very_long_design_name?node-id=0-1';
  const item = { type: 'link', title: url, url, domain: 'incorrect-metadata.example' };
  assert.equal(getItemTitle(item), 'figma.com');
  assert.equal(getItemTitle({ ...item, title: '' }), 'figma.com');
  assert.equal(getItemTitle({ ...item, title: 'My design reference' }), 'My design reference');
  assert.equal(getItemTitle({ ...item, url: 'invalid', domain: '' }), 'Saved link');
  assert.equal(getItemTitle({ type: 'note', title: url }), url);
  assert.equal(item.title, url);
});
