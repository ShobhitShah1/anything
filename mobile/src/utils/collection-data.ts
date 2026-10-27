import { isCloudEntry, type CloudCollection, type CloudEntry } from '../shared/utils/cloudSync.ts';
export interface CollectionData extends CloudCollection {
  theme: 'system' | 'light' | 'dark';
  syncUid: string;
  autoClipboard: boolean;
  journals: Record<string, { pending: CloudEntry[]; baseline?: CloudCollection }>;
}
export const emptyCollection: CollectionData = {
  items: [],
  folders: [],
  theme: 'dark',
  syncUid: '',
  autoClipboard: false,
  journals: {},
};
function validRecords(data: CloudCollection) {
  return (
    data &&
    Array.isArray(data.items) &&
    Array.isArray(data.folders) &&
    data.items.every((item) =>
      isCloudEntry({ kind: 'item', id: item?.id, data: item, deleted: false }),
    ) &&
    data.folders.every((folder) =>
      isCloudEntry({ kind: 'folder', id: folder?.id, data: folder, deleted: false }),
    )
  );
}
export function validateCollection(value: unknown): CollectionData {
  const data = value as CollectionData;
  if (!validRecords(data))
    throw new Error(
      'This collection contains unsupported records. Your existing saves have not been replaced.',
    );
  if (
    data.journals &&
    (typeof data.journals !== 'object' ||
      Array.isArray(data.journals) ||
      !Object.values(data.journals).every(
        (journal) =>
          journal &&
          Array.isArray(journal.pending) &&
          journal.pending.every(isCloudEntry) &&
          (!journal.baseline || validRecords(journal.baseline)),
      ))
  )
    throw new Error(
      'Pending cloud changes could not be read. Your collection has not been replaced.',
    );
  return {
    ...emptyCollection,
    ...data,
    theme: ['system', 'light', 'dark'].includes(data.theme) ? data.theme : 'dark',
    syncUid: typeof data.syncUid === 'string' ? data.syncUid : '',
    autoClipboard: data.autoClipboard === true,
    journals: data.journals || {},
  };
}
// Keep local edits made while a received server snapshot was waiting for the disk queue.
export function mergeQueuedCollection(
  before: CloudCollection,
  local: CloudCollection,
  remote: CloudCollection,
): CloudCollection {
  function merge<T extends { id: string }>(before: T[], local: T[], remote: T[]) {
    const original = new Map(before.map((item) => [item.id, item]));
    const latest = new Map(local.map((item) => [item.id, item]));
    const result = new Map(remote.map((item) => [item.id, item]));
    for (const [id, item] of latest)
      if (JSON.stringify(original.get(id)) !== JSON.stringify(item)) result.set(id, item);
    for (const id of original.keys()) if (!latest.has(id)) result.delete(id);
    return [...result.values()];
  }
  return {
    items: merge(before.items, local.items, remote.items),
    folders: merge(before.folders, local.folders, remote.folders),
  };
}

export function removeCollectionItems(
  value: CollectionData,
  ids: readonly string[],
): CollectionData {
  const removed = new Set(ids);
  return { ...value, items: value.items.filter((item) => !removed.has(item.id)) };
}
