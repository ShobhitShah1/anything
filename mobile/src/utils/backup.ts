import { isCloudEntry } from '../shared/utils/cloudSync.ts';
import type { SavedItem } from '../shared/types.ts';

export function parseBackup(text: string): SavedItem[] {
  if (text.length > 15_000_000) throw new Error('Import a backup smaller than 15 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('Choose an Anything JSON backup. Your collection is unchanged.');
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length > 10000 ||
    !parsed.every((item) =>
      isCloudEntry({ kind: 'item', id: item?.id, data: item, deleted: false }),
    )
  ) {
    throw new Error('This is not a supported Anything backup. Your collection is unchanged.');
  }
  return parsed;
}
