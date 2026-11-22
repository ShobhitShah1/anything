import type { SavedItem, Folder } from '../types';

const STORAGE_KEY = 'anything_items_v2';
const LEGACY_STORAGE_KEY = 'anything_vault_items_v2';
const FOLDERS_KEY = 'anything_folders_v1';

export const DEFAULT_FOLDERS: Folder[] = [
  {
    id: 'folder-instagram',
    name: 'Instagram',
    icon: 'Instagram',
    color: '#E1306C',
    createdAt: 1,
  },
  {
    id: 'folder-x',
    name: 'X (Twitter)',
    icon: 'X',
    color: '#000000',
    createdAt: 2,
  },
  {
    id: 'folder-reddit',
    name: 'Reddit',
    icon: 'Reddit',
    color: '#FF4500',
    createdAt: 3,
  },
  {
    id: 'folder-youtube',
    name: 'YouTube',
    icon: 'YouTube',
    color: '#FF0000',
    createdAt: 4,
  },
  {
    id: 'folder-tiktok',
    name: 'TikTok',
    icon: 'TikTok',
    color: '#EE1D52',
    createdAt: 5,
  },
];

export function getFolderAppKey(
  folderOrName?: { icon?: string; name?: string } | string | null,
): string {
  if (!folderOrName) return 'folder';
  const name = typeof folderOrName === 'string' ? folderOrName : folderOrName.name || '';
  const icon = typeof folderOrName === 'string' ? '' : folderOrName.icon || '';

  const iconLower = icon.toLowerCase().trim();
  const nameLower = name.toLowerCase().trim();

  // Direct icon match
  if (iconLower === 'instagram' || iconLower === 'insta' || iconLower === 'ig') return 'instagram';
  if (iconLower === 'x' || iconLower === 'twitter' || iconLower === 'x_post') return 'x';
  if (iconLower === 'reddit' || iconLower === 'reddit_post') return 'reddit';
  if (iconLower === 'youtube' || iconLower === 'yt') return 'youtube';
  if (iconLower === 'tiktok') return 'tiktok';
  if (iconLower === 'linkedin') return 'linkedin';
  if (iconLower === 'facebook' || iconLower === 'fb') return 'facebook';
  if (iconLower === 'threads') return 'threads';
  if (iconLower === 'pinterest') return 'pinterest';
  if (iconLower === 'github' || iconLower === 'git') return 'github';
  if (iconLower === 'spotify') return 'spotify';
  if (iconLower === 'discord') return 'discord';
  if (iconLower === 'code') return 'code';
  if (iconLower === 'palette' || iconLower === 'design') return 'design';
  if (iconLower === 'bookmark' || iconLower === 'read') return 'read';
  if (iconLower === 'sparkles' || iconLower === 'skills') return 'sparkles';

  // Name matching
  if (/^instagram$|^insta$|^ig$|instagram/i.test(nameLower)) return 'instagram';
  if (
    /^x$|^x\.com$|^twitter$|twitter|\bx\s*\/\s*twitter\b|\btwitter\s*\/\s*x\b|\bx\s*\(twitter\)/i.test(
      nameLower,
    )
  )
    return 'x';
  if (/^reddit$|^r\/|reddit/i.test(nameLower)) return 'reddit';
  if (/^youtube$|^youtu\.be$|^yt$|youtube/i.test(nameLower)) return 'youtube';
  if (/^tiktok$|^tik\s*tok$|tiktok/i.test(nameLower)) return 'tiktok';
  if (/^linkedin$|linkedin/i.test(nameLower)) return 'linkedin';
  if (/^facebook$|^fb$|facebook/i.test(nameLower)) return 'facebook';
  if (/^threads$|threads/i.test(nameLower)) return 'threads';
  if (/^pinterest$|pinterest/i.test(nameLower)) return 'pinterest';
  if (/^github$|github/i.test(nameLower)) return 'github';
  if (/^spotify$|spotify/i.test(nameLower)) return 'spotify';
  if (/^discord$|discord/i.test(nameLower)) return 'discord';
  if (/\b(code|tech|dev|programming|developer)\b/i.test(nameLower)) return 'code';
  if (/\b(design|inspo|inspiration|art|ui|ux)\b/i.test(nameLower)) return 'design';
  if (/\b(read|reading|book|books|articles|read later)\b/i.test(nameLower)) return 'read';
  if (/\b(sparkles|skills|prompts|prompt|ai)\b/i.test(nameLower)) return 'sparkles';

  return 'folder';
}

export function getFolderMeta(name: string): { icon: string; color?: string } {
  const key = getFolderAppKey(name);
  switch (key) {
    case 'instagram':
      return { icon: 'Instagram', color: '#E1306C' };
    case 'x':
      return { icon: 'X', color: '#000000' };
    case 'reddit':
      return { icon: 'Reddit', color: '#FF4500' };
    case 'youtube':
      return { icon: 'YouTube', color: '#FF0000' };
    case 'tiktok':
      return { icon: 'TikTok', color: '#000000' };
    case 'linkedin':
      return { icon: 'LinkedIn', color: '#0A66C2' };
    case 'facebook':
      return { icon: 'Facebook', color: '#1877F2' };
    case 'threads':
      return { icon: 'Threads', color: '#000000' };
    case 'pinterest':
      return { icon: 'Pinterest', color: '#BD081C' };
    case 'github':
      return { icon: 'GitHub', color: '#24292F' };
    case 'spotify':
      return { icon: 'Spotify', color: '#1DB954' };
    case 'discord':
      return { icon: 'Discord', color: '#5865F2' };
    case 'code':
      return { icon: 'Code', color: '#0EA5E9' };
    case 'design':
      return { icon: 'Palette', color: '#EC4899' };
    case 'read':
      return { icon: 'Bookmark', color: '#10B981' };
    case 'sparkles':
      return { icon: 'Sparkles', color: '#6366F1' };
    default:
      return { icon: 'Folder' };
  }
}

export function loadSavedItems(): SavedItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!data) {
      return [];
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load items from storage:', err);
    return [];
  }
}

export function saveItemsToStorage(items: SavedItem[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (err) {
    console.error('Failed to save items to storage:', err);
    return false;
  }
}

export function loadFolders(): Folder[] {
  try {
    const data = localStorage.getItem(FOLDERS_KEY);
    if (!data) {
      // First time initialize with default folders
      saveFolders(DEFAULT_FOLDERS);
      return DEFAULT_FOLDERS;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return DEFAULT_FOLDERS;
    // Upgrade legacy default folders if present
    const legacyIds = new Set(['folder-skills', 'folder-tech', 'folder-design', 'folder-read']);
    if (parsed.length > 0 && parsed.every((f) => legacyIds.has(f.id))) {
      saveFolders(DEFAULT_FOLDERS);
      return DEFAULT_FOLDERS;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load folders from storage:', err);
    return DEFAULT_FOLDERS;
  }
}

export function saveFolders(folders: Folder[]): void {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.error('Failed to save folders to storage:', err);
  }
}

export function exportItemsToJson(items: SavedItem[]) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(items, null, 2),
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute(
    'download',
    `anything-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Backwards compatibility alias
export const exportVaultToJson = exportItemsToJson;

export function parseSocialUrl(url: string): {
  detectedType: 'x_post' | 'reddit_post' | 'instagram_post' | 'image' | 'link';
  extractedInfo?: {
    handle?: string;
    subreddit?: string;
    title?: string;
  };
} {
  const clean = url.trim();

  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`).hostname.replace(
      /^www\./,
      '',
    );
  } catch {
    return { detectedType: 'link', extractedInfo: { title: 'Link' } };
  }

  // X / Twitter
  if (['twitter.com', 'x.com', 'mobile.twitter.com'].includes(host)) {
    const match = clean.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    const handle = match ? match[1] : 'user';
    return {
      detectedType: 'x_post',
      extractedInfo: { handle, title: `@${handle}` },
    };
  }

  // Reddit
  if (['reddit.com', 'old.reddit.com'].includes(host)) {
    const subMatch = clean.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/);
    const sub = subMatch ? `r/${subMatch[1]}` : 'r/reddit';
    return {
      detectedType: 'reddit_post',
      extractedInfo: { subreddit: sub, title: sub },
    };
  }

  // Instagram
  if (host === 'instagram.com') {
    const instaMatch = clean.match(/instagram\.com\/(?:p|reel|([a-zA-Z0-9_.]+))/);
    const handle = instaMatch && instaMatch[1] ? instaMatch[1] : 'instagram';
    return {
      detectedType: 'instagram_post',
      extractedInfo: { handle, title: `@${handle}` },
    };
  }

  // Image URL
  if (clean.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i)) {
    return {
      detectedType: 'image',
      extractedInfo: { title: 'Image' },
    };
  }

  // Generic Link
  return {
    detectedType: 'link',
    extractedInfo: { title: 'Link' },
  };
}
