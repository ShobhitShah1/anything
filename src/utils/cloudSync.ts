import type { Folder, SavedItem } from '../types';

export interface CloudCollection { items: SavedItem[]; folders: Folder[] }
export interface CloudEntry { kind: 'item' | 'folder'; id: string; deleted: boolean; data: SavedItem | Folder | null }
export interface CloudStore {
  watch: (receive: (entries: CloudEntry[]) => void, fail: (error: unknown) => void) => () => void;
  write: (entries: CloudEntry[]) => Promise<void>;
}
const itemTypes = new Set(['note', 'markdown', 'link', 'image', 'code', 'secret', 'x_post', 'reddit_post', 'instagram_post']);
const webUrl = (value: unknown) => {
  try { const url = new URL(value as string); return typeof value === 'string' && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
};
export function isCloudEntry(value: unknown): value is CloudEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as CloudEntry;
  if (!['item', 'folder'].includes(entry.kind) || typeof entry.id !== 'string' || !entry.id || entry.id.length > 500 || typeof entry.deleted !== 'boolean') return false;
  if (entry.deleted) return entry.data === null;
  if (!entry.data || entry.data.id !== entry.id || !Number.isFinite(entry.data.createdAt) || !Number.isFinite(new Date(entry.data.createdAt).getTime())) return false;
  if (entry.kind === 'folder') return typeof (entry.data as Folder).name === 'string';
  const item = entry.data as SavedItem;
  if (!itemTypes.has(item.type) || typeof item.title !== 'string' || typeof item.isPinned !== 'boolean' || !Array.isArray(item.tags) || !item.tags.every(tag => typeof tag === 'string')) return false;
  switch (item.type) {
    case 'note': return typeof item.content === 'string' && (!item.checklist || (Array.isArray(item.checklist) && item.checklist.every(check => check && typeof check.id === 'string' && typeof check.text === 'string' && typeof check.completed === 'boolean')));
    case 'markdown': return typeof item.content === 'string';
    case 'code': return typeof item.code === 'string' && typeof item.language === 'string';
    case 'secret': return typeof item.secretValue === 'string' && typeof item.category === 'string';
    case 'image': return typeof item.imageUrl === 'string';
    case 'link': return webUrl(item.url) && typeof item.domain === 'string';
    case 'x_post': return webUrl(item.postUrl) && typeof item.content === 'string' && typeof item.authorName === 'string' && typeof item.authorHandle === 'string';
    case 'reddit_post': return webUrl(item.postUrl) && typeof item.content === 'string' && typeof item.author === 'string' && typeof item.subreddit === 'string';
    case 'instagram_post': return (!item.postUrl || webUrl(item.postUrl)) && typeof item.imageUrl === 'string' && typeof item.caption === 'string' && typeof item.handle === 'string';
  }
}
const keyOf = (entry: CloudEntry) => `${entry.kind}:${entry.id}`;
// Firestore map field order is not meaningful; normalize it before comparing snapshots.
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value, (_key, entry) =>
  entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]]))
    : entry,
));
function sameEntries(a: Map<string, CloudEntry>, b: Map<string, CloudEntry>) {
  return a.size === b.size && [...a].every(([key, entry]) => JSON.stringify(entry) === JSON.stringify(b.get(key)));
}
function entriesOf(value: CloudCollection): Map<string, CloudEntry> {
  return new Map([...value.items.map(data => ({ kind: 'item' as const, id: data.id, deleted: false, data })),
    ...value.folders.map(data => ({ kind: 'folder' as const, id: data.id, deleted: false, data }))].map(entry => [keyOf(entry), clean(entry)]));
}

// Pending edits survive refreshes; tombstones prevent another device restoring deleted saves.
export function startCollectionSync(options: {
  initial: CloudCollection;
  baseline?: CloudCollection;
  store: CloudStore;
  pending: CloudEntry[];
  persistPending: (entries: CloudEntry[]) => void;
  persistBaseline?: (collection: CloudCollection) => void;
  apply: (collection: CloudCollection) => void;
  status: (status: 'connecting' | 'syncing' | 'synced' | 'error', error?: unknown) => void;
}) {
  let current = entriesOf(options.initial);
  if (!options.pending.every(isCloudEntry)) throw new Error('Pending sync data could not be read. Your local saves are unchanged.');
  const pending = new Map(options.pending.map(entry => [keyOf(entry), clean(entry)]));
  if (options.baseline) {
    const baseline = entriesOf(options.baseline);
    for (const [key, entry] of current) if (JSON.stringify(baseline.get(key)) !== JSON.stringify(entry)) pending.set(key, entry);
    for (const [key, entry] of baseline) if (!current.has(key)) pending.set(key, { kind: entry.kind, id: entry.id, deleted: true, data: null });
  }
  let ready = false;
  let stopped = false;
  let writing = false;
  const connectionTimer = setTimeout(() => {
    if (!stopped && !ready) options.status('error', new Error('Could not reach your cloud collection. Check that Cloud Firestore has a (default) database and the private access rules are published. Also check your connection, then retry. Local saves are safe.'));
  }, 15_000);
  const localCollection = () => {
    const active = [...current.values()].filter(entry => !entry.deleted);
    return { items: active.filter(entry => entry.kind === 'item').map(entry => entry.data as SavedItem), folders: active.filter(entry => entry.kind === 'folder').map(entry => entry.data as Folder) };
  };
  const persist = () => {
    options.persistPending([...pending.values()]);
    options.persistBaseline?.(localCollection());
  };
  const fail = (error: unknown) => { clearTimeout(connectionTimer); if (!stopped) options.status('error', error); };
  const publish = (entries: Map<string, CloudEntry>) => {
    if (sameEntries(current, entries)) return false;
    current = entries;
    options.apply(localCollection());
    return true;
  };
  const flush = async () => {
    if (!ready || stopped || writing || !pending.size) return;
    writing = true;
    options.status('syncing');
    try {
      while (pending.size && !stopped) {
        const batch = [...pending.entries()].slice(0, 100);
        await options.store.write(batch.map(([, entry]) => entry));
        if (stopped) return;
        for (const [key, entry] of batch) if (pending.get(key) === entry) pending.delete(key);
        persist();
      }
      if (!stopped) options.status('synced');
    } catch (error) { fail(error); }
    finally { writing = false; }
  };
  options.status('connecting');
  const unsubscribe = options.store.watch(entries => {
    if (stopped) return;
    try {
      if (!entries.every(isCloudEntry)) throw new Error('The cloud collection contains an unsupported record. Local saves are unchanged.');
      const merged = new Map(entries.map(entry => [keyOf(entry), clean(entry)]));
      if (!ready) {
        for (const [key, entry] of current) if (!merged.has(key) && !pending.has(key)) pending.set(key, entry);
      }
      for (const [key, entry] of pending) merged.set(key, entry);
      const initial = !ready;
      ready = true;
      clearTimeout(connectionTimer);
      const changed = publish(merged);
      if (initial || changed || pending.size) persist();
      if (pending.size) void flush();
      else options.status('synced');
    } catch (error) { fail(error); }
  }, fail);
  return {
    update(value: CloudCollection) {
      if (stopped) return;
      const next = entriesOf(value);
      for (const [key, entry] of next) {
        if (JSON.stringify(current.get(key)) !== JSON.stringify(entry)) pending.set(key, entry);
      }
      for (const [key, entry] of current) {
        if (!entry.deleted && !next.has(key)) pending.set(key, { kind: entry.kind, id: entry.id, deleted: true, data: null });
      }
      // Keep tombstones in the baseline so a remote echo cannot resurrect deleted content.
      for (const [key, entry] of current) if (entry.deleted && !next.has(key)) next.set(key, entry);
      if (sameEntries(current, next)) return;
      current = next;
      try { persist(); void flush(); } catch (error) { fail(error); }
    },
    retry: flush,
    stop() { stopped = true; clearTimeout(connectionTimer); unsubscribe(); },
  };
}
