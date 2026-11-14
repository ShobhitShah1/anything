import type { SavedItem } from '../types';

export function noteTitleFromContent(content: string): string {
  const firstLine = content.trim().split(/\r?\n/u, 1)[0]?.trim() || '';

  return firstLine
    ? firstLine.length > 72
      ? `${firstLine.slice(0, 69).trimEnd()}…`
      : firstLine
    : 'Note';
}

export function noteBodyAfterTitle(content: string, title: string): string {
  return noteTitleFromContent(content) === title
    ? content.trimStart().split(/\r?\n/u).slice(1).join('\n').trim()
    : content;
}

export function getItemTitle(item: SavedItem): string {
  if (item.type === 'note' && (!item.title.trim() || item.title.trim().toLowerCase() === 'note'))
    return noteTitleFromContent(item.content || '');

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
