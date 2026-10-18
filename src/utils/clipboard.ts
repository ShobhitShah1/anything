import { SavedItem, ItemType } from '../types';
import { parseSocialUrl } from './storage';

const CLIPBOARD_PERMISSION_KEY = 'anything_clipboard_permission';

export type ClipboardPermissionState = 'granted' | 'denied' | 'prompt';

export function getClipboardPermission(): ClipboardPermissionState {
  return (localStorage.getItem(CLIPBOARD_PERMISSION_KEY) as ClipboardPermissionState) || 'prompt';
}

export function setClipboardPermission(state: ClipboardPermissionState) {
  localStorage.setItem(CLIPBOARD_PERMISSION_KEY, state);
}

export interface ClipboardReadResult {
  text: string | null;
  status: 'ok' | 'empty' | 'permission_denied' | 'unsupported';
  error?: string;
}

export async function readClipboardSafely(): Promise<ClipboardReadResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return { text: null, status: 'unsupported', error: 'Clipboard API not supported in this browser' };
  }

  try {
    const text = await navigator.clipboard.readText();
    const clean = text ? text.trim() : '';
    if (!clean) {
      return { text: null, status: 'empty', error: 'Clipboard is currently empty' };
    }
    return { text: clean, status: 'ok' };
  } catch (err: any) {
    const message = err?.message || 'Access was not granted by browser';
    return { text: null, status: 'permission_denied', error: message };
  }
}

export interface DetectedClipboardInfo {
  type: ItemType;
  title: string;
  subtitle: string;
  url?: string;
  content: string;
}

export function autoDetectClipboardContent(text: string): DetectedClipboardInfo {
  const trimmed = text.trim();

  // Social link check
  const social = parseSocialUrl(trimmed);
  if (social.detectedType === 'x_post') {
    return {
      type: 'x_post',
      title: social.extractedInfo?.title || '𝕏 Post',
      subtitle: social.extractedInfo?.handle ? `Post by @${social.extractedInfo.handle}` : '𝕏 / Twitter post',
      url: trimmed,
      content: trimmed,
    };
  }

  if (social.detectedType === 'reddit_post') {
    return {
      type: 'reddit_post',
      title: social.extractedInfo?.title || 'Reddit Post',
      subtitle: social.extractedInfo?.subreddit ? `r/${social.extractedInfo.subreddit}` : 'Reddit thread',
      url: trimmed,
      content: trimmed,
    };
  }

  if (social.detectedType === 'instagram_post') {
    return {
      type: 'instagram_post',
      title: social.extractedInfo?.handle ? `@${social.extractedInfo.handle}` : 'Instagram Post',
      subtitle: 'Instagram visual media',
      url: trimmed,
      content: trimmed,
    };
  }

  // Web URL check
  const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') ||
    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(trimmed);

  if (isUrl && !trimmed.includes('\n')) {
    let domain = 'link';
    try {
      domain = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`).hostname.replace('www.', '');
    } catch {
      domain = 'link';
    }
    return {
      type: 'link',
      title: domain,
      subtitle: trimmed.length > 50 ? `${trimmed.slice(0, 48)}...` : trimmed,
      url: trimmed,
      content: trimmed,
    };
  }

  // Markdown check
  if (trimmed.startsWith('# ') || trimmed.includes('```') || trimmed.startsWith('## ')) {
    const firstLine = trimmed.split('\n')[0].replace(/^#+\s*/, '') || 'Markdown Document';
    return {
      type: 'markdown',
      title: firstLine,
      subtitle: 'Markdown document or skill prompt',
      content: trimmed,
    };
  }

  // Secret / API token check
  if (/^(sk-[a-zA-Z0-9]{16,}|ghp_[a-zA-Z0-9]{16,}|ey[a-zA-Z0-9_-]{20,})/.test(trimmed)) {
    return {
      type: 'secret',
      title: trimmed.startsWith('sk-') ? 'OpenAI / Secret API Key' : trimmed.startsWith('ghp_') ? 'GitHub Access Token' : 'Auth Token',
      subtitle: 'Masked secret credential',
      content: trimmed,
    };
  }

  // Code snippet check
  if (trimmed.includes('const ') || trimmed.includes('function ') || trimmed.includes('import ') || trimmed.includes('export ') || trimmed.includes('class ')) {
    return {
      type: 'code',
      title: 'Code Snippet',
      subtitle: `${trimmed.split('\n').length} lines of code`,
      content: trimmed,
    };
  }

  // General Note
  const preview = trimmed.split('\n')[0];
  return {
    type: 'note',
    title: preview.length > 40 ? `${preview.slice(0, 38)}...` : preview,
    subtitle: trimmed.length > 60 ? `${trimmed.slice(0, 58)}...` : trimmed,
    content: trimmed,
  };
}

export function findDuplicateItem(queryUrlOrContent: string, items: SavedItem[]): SavedItem | null {
  const clean = queryUrlOrContent.trim().toLowerCase();
  if (!clean || clean.length < 3) return null;

  for (const item of items) {
    if ('url' in item && item.url && item.url.trim().toLowerCase() === clean) {
      return item;
    }
    if ('postUrl' in item && item.postUrl && item.postUrl.trim().toLowerCase() === clean) {
      return item;
    }
    if ('secretValue' in item && item.secretValue && item.secretValue.trim() === queryUrlOrContent.trim()) {
      return item;
    }
    if ('content' in item && item.content && item.content.trim().toLowerCase() === clean && clean.length > 15) {
      return item;
    }
  }

  return null;
}
