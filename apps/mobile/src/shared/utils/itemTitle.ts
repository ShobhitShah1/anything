import type { SavedItem } from '../types';

export function getItemTitle(item: SavedItem): string {
  if (
    item.type === 'reddit_post' &&
    (!item.title.trim() ||
      ['reddit', 'reddit post', item.subreddit.toLowerCase()].includes(
        item.title.trim().toLowerCase(),
      ))
  ) {
    const slug = item.postUrl.match(/\/comments\/[^/]+\/([^/?#]+)/i)?.[1];

    if (slug) {
      let title = slug;

      try {
        title = decodeURIComponent(title);
      } catch {
        // Keep the URL slug readable even if it contains malformed escapes.
      }

      const readable = title
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/^./, (value) => value.toUpperCase());

      return readable || 'Reddit post';
    }

    return 'Reddit post';
  }

  if (item.type !== 'link' || (item.title.trim() && !/^https?:\/\/\S+$/i.test(item.title.trim())))
    return item.title;
  try {
    return new URL(item.url).hostname.replace(/^www\./, '');
  } catch {
    return item.domain || 'Saved link';
  }
}
