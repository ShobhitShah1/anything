import { normalizeUrl } from '../shared/utils/fetchPreview.ts';

export type TextSegment = { text: string; href?: string };

export function linkifyText(text: string): TextSegment[] {
  const pattern =
    /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[\da-z-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"'`]*)?/gi;
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const start = match.index;
    if (start > 0 && /[\w@.]/.test(text[start - 1])) continue;

    let visible = raw.replace(/[.,;!?]+$/, '');
    for (const [open, close] of [
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
    ]) {
      while (visible.endsWith(close) && visible.split(close).length > visible.split(open).length)
        visible = visible.slice(0, -1);
    }
    if (!visible) continue;

    let href: string;
    try {
      href = normalizeUrl(visible);
      if (!new URL(href).hostname.includes('.')) continue;
    } catch {
      continue;
    }

    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({ text: visible, href });
    cursor = start + visible.length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  return segments.length ? segments : [{ text }];
}
