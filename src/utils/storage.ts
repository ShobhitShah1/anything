import { SavedItem, Folder } from '../types';

const STORAGE_KEY = 'anything_items_v2';
const LEGACY_STORAGE_KEY = 'anything_vault_items_v2';
const FOLDERS_KEY = 'anything_folders_v1';

export const DEFAULT_FOLDERS: Folder[] = [
  { id: 'folder-skills', name: 'Skills & Prompts', icon: 'Sparkles', color: '#6366F1', createdAt: 1 },
  { id: 'folder-tech', name: 'Tech & Code', icon: 'Code', color: '#0EA5E9', createdAt: 2 },
  { id: 'folder-design', name: 'Design Inspo', icon: 'Palette', color: '#EC4899', createdAt: 3 },
  { id: 'folder-read', name: 'Read Later', icon: 'Bookmark', color: '#10B981', createdAt: 4 },
];

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

export function saveItemsToStorage(items: SavedItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save items to storage:', err);
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FOLDERS;
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
    JSON.stringify(items, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute(
    'download',
    `anything-backup-${new Date().toISOString().slice(0, 10)}.json`
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

  // X / Twitter
  if (clean.includes('twitter.com') || clean.includes('x.com')) {
    const match = clean.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    const handle = match ? match[1] : 'user';
    return {
      detectedType: 'x_post',
      extractedInfo: { handle, title: `@${handle}` }
    };
  }

  // Reddit
  if (clean.includes('reddit.com')) {
    const subMatch = clean.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/);
    const sub = subMatch ? `r/${subMatch[1]}` : 'r/reddit';
    return {
      detectedType: 'reddit_post',
      extractedInfo: { subreddit: sub, title: sub }
    };
  }

  // Instagram
  if (clean.includes('instagram.com')) {
    const instaMatch = clean.match(/instagram\.com\/(?:p|reel|([a-zA-Z0-9_.]+))/);
    const handle = instaMatch && instaMatch[1] ? instaMatch[1] : 'instagram';
    return {
      detectedType: 'instagram_post',
      extractedInfo: { handle, title: `@${handle}` }
    };
  }

  // Image URL
  if (clean.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i)) {
    return {
      detectedType: 'image',
      extractedInfo: { title: 'Image' }
    };
  }

  // Generic Link
  return {
    detectedType: 'link',
    extractedInfo: { title: 'Link' }
  };
}
