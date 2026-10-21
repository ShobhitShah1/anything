import type { SavedItem } from '../types';
import { autoDetectClipboardContent, findDuplicateItem } from './clipboard.ts';
import { getImmediateLinkPreview, isDirectImageUrl, normalizeUrl } from './fetchPreview.ts';
import { parseSocialUrl } from './storage.ts';

export function extractLinks(text: string): string[] {
  const candidates: string[] = text.match(/(?:https?:\/\/|www\.)[^\s<>"'`]+/gi) || [];
  for (const token of text.trim().split(/\s+/)) {
    if (/^(?:[\da-z-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i.test(token)) candidates.push(token);
  }
  const urls = new Set<string>();
  for (let candidate of candidates) {
    candidate = candidate.replace(/[.,;]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (candidate.endsWith(close) && candidate.split(close).length > candidate.split(open).length) candidate = candidate.slice(0, -1);
    }
    try {
      const url = normalizeUrl(candidate);
      if (new URL(url).hostname) urls.add(url);
    } catch { /* Unsupported URLs are never saved or fetched. */ }
  }
  return [...urls];
}

export function createQuickCaptures(text: string, existing: SavedItem[], linksOnly = false, folderId?: string) {
  if (typeof text !== 'string' || !text.trim() || text.length > 50_000) throw new Error('Paste up to 50,000 characters to save.');
  const clean = text.trim();
  const links = extractLinks(clean);
  if (links.length > 100) throw new Error('Save up to 100 links at a time.');
  if (linksOnly && !links.length) throw new Error('Paste a valid link, or several links together.');
  const singleUrl = !/\s/.test(clean) && links.length === 1;
  const isLinkList = links.length > 1 && clean.split(/\s+/).every(token => extractLinks(token).length === 1);
  const entries = linksOnly || isLinkList || singleUrl ? links : [clean];
  const items: SavedItem[] = [];
  let duplicates = 0;
  for (const content of entries) {
    if (findDuplicateItem(content, [...items, ...existing])) { duplicates++; continue; }
    const base = { id: crypto.randomUUID(), createdAt: Date.now(), isPinned: false, tags: [], folderId };
    if (links.includes(content)) {
      const preview = getImmediateLinkPreview(content);
      const social = parseSocialUrl(content);
      if (isDirectImageUrl(content)) items.push({ ...base, type: 'image', title: preview.title, imageUrl: content });
      else if (social.detectedType === 'x_post') items.push({ ...base, type: 'x_post', title: social.extractedInfo?.title || 'X post', postUrl: content, authorName: social.extractedInfo?.handle || 'Creator', authorHandle: social.extractedInfo?.handle || 'creator', content: 'Post on X' });
      else if (social.detectedType === 'reddit_post') items.push({ ...base, type: 'reddit_post', title: social.extractedInfo?.title || 'Reddit post', postUrl: content, subreddit: social.extractedInfo?.subreddit || 'r/reddit', author: '', content: '' });
      else if (social.detectedType === 'instagram_post') items.push({ ...base, type: 'instagram_post', title: 'Instagram post', postUrl: content, handle: social.extractedInfo?.handle || 'instagram', caption: '', imageUrl: '' });
      else items.push({ ...base, type: 'link', title: preview.title, url: content, domain: preview.domain, previewImage: preview.imageUrl, favicon: preview.favicon, description: preview.description });
    } else {
      const detected = autoDetectClipboardContent(content);
      if (detected.type === 'code') items.push({ ...base, type: 'code', title: detected.title, code: content, language: 'text' });
      else if (detected.type === 'markdown') items.push({ ...base, type: 'markdown', title: detected.title, content });
      else if (detected.type === 'secret') items.push({ ...base, type: 'secret', title: detected.title, category: 'token', secretValue: content });
      else items.push({ ...base, type: 'note', title: 'Note', content, typography: 'sans' });
    }
  }
  return { items, duplicates };
}
