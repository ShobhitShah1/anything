import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCloudEntry, startCollectionSync } from '../shared/utils/cloudSync.ts';
import { startCollectionSync as startWebCollectionSync } from '../../../src/utils/cloudSync.ts';

const note = (id, content = id) => ({
  id,
  type: 'note',
  title: id,
  content,
  tags: [],
  isPinned: false,
  createdAt: 1,
});
const record = (data) => ({ kind: 'item', id: data.id, deleted: false, data });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function harness(
  initial,
  pending = [],
  write = async () => {},
  baseline,
  start = startCollectionSync,
) {
  let receive;
  let failed;
  const writes = [];
  const applied = [];
  const states = [];
  const journals = [];
  let journal = pending;
  const sync = start({
    initial,
    pending,
    baseline,
    store: {
      watch: (next, fail) => {
        receive = next;
        failed = fail;
        return () => {};
      },
      write: async (entries) => {
        writes.push(entries);
        await write(entries);
      },
    },
    apply: (next) => applied.push(next),
    persistPending: (next) => {
      journal = next;
      journals.push(next);
    },
    status: (state, error) => states.push({ state, error }),
  });
  return {
    sync,
    writes,
    applied,
    states,
    journals,
    receive: (entries) => receive(entries),
    fail: (error) => failed(error),
    journal: () => journal,
  };
}

for (const [name, start] of [
  ['mobile', startCollectionSync],
  ['web', startWebCollectionSync],
]) {
  test(`${name}: server field and document ordering never turns an unchanged snapshot into an upload`, async () => {
    const initial = {
      items: [note('one'), note('two')],
      folders: [{ id: 'reading', name: 'Reading', createdAt: 1 }],
    };
    const serverRecord = (entry) => ({
      data: Object.fromEntries(Object.entries(entry.data).reverse()),
      deleted: entry.deleted,
      id: entry.id,
      kind: entry.kind,
    });
    const records = [
      ...initial.items.map(record),
      { kind: 'folder', id: 'reading', deleted: false, data: initial.folders[0] },
    ];
    const h = harness(initial, [], async () => {}, undefined, start);
    try {
      h.receive(records.map(serverRecord).reverse());
      h.sync.update(h.applied.at(-1) ?? initial);
      await tick();
      assert.equal(h.writes.length, 0);
      assert.equal(h.applied.length, 0);
      assert.equal(h.journals.length, 1);

      const edited = { ...initial, items: [note('one', 'changed'), note('two')] };
      h.sync.update(edited);
      await tick();
      assert.equal(h.writes.length, 1);
      assert.deepEqual(
        h.writes[0].map((entry) => entry.id),
        ['one'],
      );
      const echoed = records
        .map((entry) => (entry.id === 'one' ? record(edited.items[0]) : entry))
        .map(serverRecord);
      const idleWrites = h.journals.length;
      for (let count = 0; count < 3; count++) {
        h.receive(count % 2 ? echoed : [...echoed].reverse());
        h.sync.update(h.applied.at(-1) ?? edited);
        await tick();
      }
      assert.equal(h.writes.length, 1);
      assert.equal(h.journals.length, idleWrites);
      assert.deepEqual(h.journal(), []);
      assert.equal(h.states.at(-1).state, 'synced');
    } finally {
      h.sync.stop();
    }
  });
}

test('initial sync waits for remote data, merges local-only saves, and does not overwrite existing cloud records', async () => {
  const h = harness({ items: [note('local'), note('both', 'older')], folders: [] });
  assert.equal(h.writes.length, 0);
  h.receive([record(note('remote')), record(note('both', 'cloud'))]);
  await tick();
  assert.deepEqual(
    h.applied.at(-1).items.map((item) => item.id),
    ['remote', 'both', 'local'],
  );
  assert.equal(h.applied.at(-1).items.find((item) => item.id === 'both').content, 'cloud');
  assert.deepEqual(
    h.writes.flat().map((entry) => entry.id),
    ['local'],
  );
  assert.deepEqual(h.journal(), []);
  h.sync.stop();
});

test('deletions persist as tombstones and remote deletion wins over a stale local copy after refresh', async () => {
  const h = harness({ items: [note('one')], folders: [] });
  h.receive([record(note('one'))]);
  h.sync.update({ items: [], folders: [] });
  await tick();
  const deletion = h.writes[0][0];
  assert.deepEqual(deletion, { kind: 'item', id: 'one', deleted: true, data: null });
  const other = harness({ items: [note('one')], folders: [] });
  other.receive([deletion]);
  await tick();
  assert.deepEqual(other.applied.at(-1).items, []);
  assert.equal(other.writes.length, 0);
  h.sync.stop();
  other.sync.stop();
});

test('failed writes keep pending edits across refresh and retry without losing local text', async () => {
  const h = harness({ items: [], folders: [] }, [], async () => {
    throw new Error('offline');
  });
  h.receive([]);
  h.sync.update({ items: [note('draft', 'keep me')], folders: [] });
  await tick();
  assert.equal(h.states.at(-1).state, 'error');
  assert.equal(h.journal()[0].data.content, 'keep me');
  const restored = harness({ items: [note('draft', 'old')], folders: [] }, h.journal());
  restored.receive([]);
  await tick();
  assert.equal(restored.applied.at(-1).items[0].content, 'keep me');
  assert.deepEqual(restored.journal(), []);
  h.sync.stop();
  restored.sync.stop();
});

test('an edit made while a write is pending is sent after it, rather than acknowledged with the older write', async () => {
  let finish;
  let first = true;
  const h = harness({ items: [note('one')], folders: [] }, [], async () => {
    if (first) {
      first = false;
      await new Promise((resolve) => {
        finish = resolve;
      });
    }
  });
  h.receive([record(note('one'))]);
  h.sync.update({ items: [note('one', 'first')], folders: [] });
  h.sync.update({ items: [note('one', 'latest')], folders: [] });
  h.receive([record(note('one', 'older remote'))]);
  assert.equal(h.journal()[0].data.content, 'latest');
  finish();
  await tick();
  assert.deepEqual(
    h.writes.map((entries) => entries[0].data.content),
    ['first', 'latest'],
  );
  assert.deepEqual(h.journal(), []);
  h.sync.stop();
});

test('folders sync and empty folder collections stay empty; malformed remote data never replaces local saves', async () => {
  const folder = { id: 'folder', name: 'Reading', createdAt: 1 };
  const h = harness({ items: [note('safe')], folders: [folder] });
  h.receive([{ kind: 'folder', id: 'folder', deleted: true, data: null }, record(note('safe'))]);
  assert.deepEqual(h.applied.at(-1).folders, []);
  const count = h.applied.length;
  h.receive([{ kind: 'item', id: 'bad', deleted: false, data: { id: 'bad' } }]);
  assert.equal(h.states.at(-1).state, 'error');
  assert.equal(h.applied.length, count);
  assert.equal(isCloudEntry(record({ ...note('bad'), content: undefined })), false);
  assert.equal(isCloudEntry({ ...record(note('bad')), id: 'different-id' }), false);
  assert.equal(
    isCloudEntry(
      record({ ...note('bad'), type: 'link', url: 'javascript:alert(1)', domain: 'bad' }),
    ),
    false,
  );
  assert.equal(isCloudEntry(record({ ...note('bad'), createdAt: 1e30 })), false);
  h.sync.stop();
});

test('stopping sync prevents late remote callbacks and keeps an unacknowledged write for the next session', async () => {
  let finish;
  const h = harness(
    { items: [], folders: [] },
    [],
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  h.receive([]);
  h.sync.update({ items: [note('pending')], folders: [] });
  h.sync.stop();
  h.receive([record(note('another-account'))]);
  finish();
  await tick();
  assert.equal(h.applied.length, 0);
  assert.equal(h.journal()[0].id, 'pending');
});

test('local edits and deletions made while sync was paused survive reconnecting to older cloud content', async () => {
  const baseline = { items: [note('edit', 'before'), note('delete')], folders: [] };
  const h = harness({ items: [note('edit', 'after')], folders: [] }, [], async () => {}, baseline);
  h.receive(baseline.items.map(record));
  await tick();
  assert.deepEqual(
    h.applied.at(-1).items.map((item) => [item.id, item.content]),
    [['edit', 'after']],
  );
  assert.equal(h.writes.flat().find((entry) => entry.id === 'delete').deleted, true);
  h.sync.stop();
});

test('a database that never responds leaves connecting after 15 seconds and can recover when it responds', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness({ items: [note('safe')], folders: [] });
  t.mock.timers.tick(15_000);
  assert.equal(h.states.at(-1).state, 'error');
  assert.match(h.states.at(-1).error.message, /Cloud Firestore/);
  assert.equal(h.writes.length, 0);
  assert.equal(h.applied.length, 0);
  h.receive([record(note('safe'))]);
  assert.equal(h.states.at(-1).state, 'synced');
  h.sync.stop();
});

test('stopping a connection cancels its timeout without reporting an error in another account', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness({ items: [], folders: [] });
  h.sync.stop();
  t.mock.timers.tick(30_000);
  assert.equal(h.states.at(-1).state, 'connecting');
});
