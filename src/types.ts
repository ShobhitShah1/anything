export type ItemType = 
  | 'x_post' 
  | 'reddit_post' 
  | 'instagram_post' 
  | 'note' 
  | 'secret' 
  | 'image' 
  | 'link' 
  | 'code'
  | 'markdown';

export interface Folder {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  createdAt: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface BaseItem {
  id: string;
  type: ItemType;
  title: string;
  createdAt: number;
  isPinned: boolean;
  tags: string[];
  folderId?: string; // Folder association
  colorTint?: string; // Subtle aesthetic tint e.g. '#FAFAFA'
}

export interface XPostItem extends BaseItem {
  type: 'x_post';
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  content: string;
  postUrl: string;
  imageUrl?: string;
  likes?: number;
  reposts?: number;
  isVerified?: boolean;
}

export interface RedditPostItem extends BaseItem {
  type: 'reddit_post';
  subreddit: string; // e.g. 'r/webdev'
  author: string;
  content: string;
  postUrl: string;
  upvotes?: number;
  commentsCount?: number;
  imageUrl?: string;
  flair?: string;
}

export interface InstagramPostItem extends BaseItem {
  type: 'instagram_post';
  handle: string;
  caption: string;
  imageUrl: string;
  postUrl?: string;
  likes?: number;
}

export interface NoteItem extends BaseItem {
  type: 'note';
  content: string;
  checklist?: ChecklistItem[];
  typography?: 'sans' | 'mono' | 'serif';
}

export interface MarkdownItem extends BaseItem {
  type: 'markdown';
  content: string; // Markdown text (e.g. SKILL.md, guide, prompts, docs)
  isSkill?: boolean;
}

export interface SecretItem extends BaseItem {
  type: 'secret';
  category: 'password' | 'api_key' | 'wifi' | 'token' | 'seed_phrase' | 'other';
  username?: string;
  secretValue: string;
  notes?: string;
}

export interface ImageItem extends BaseItem {
  type: 'image';
  imageUrl: string;
  caption?: string;
  dimensions?: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape';
}

export interface LinkItem extends BaseItem {
  type: 'link';
  url: string;
  domain: string;
  description?: string;
  previewImage?: string;
  favicon?: string;
}

export interface CodeItem extends BaseItem {
  type: 'code';
  code: string;
  language: string;
  description?: string;
}

export type SavedItem = 
  | XPostItem 
  | RedditPostItem 
  | InstagramPostItem 
  | NoteItem 
  | MarkdownItem
  | SecretItem 
  | ImageItem 
  | LinkItem 
  | CodeItem;

export type ViewMode = 'masonry' | 'list' | 'focus';
