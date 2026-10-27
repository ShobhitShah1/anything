import type { SavedItem } from '../types';

export function getItemTitle(item: SavedItem): string {
  if (item.type !== 'link' || (item.title.trim() && !/^https?:\/\/\S+$/i.test(item.title.trim())))
    return item.title;
  try {
    return new URL(item.url).hostname.replace(/^www\./, '');
  } catch {
    return item.domain || 'Saved link';
  }
}
