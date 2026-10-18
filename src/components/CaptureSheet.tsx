import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  X,
  Pin, 
  Upload, 
  Check, 
  Sparkles, 
  Eye, 
  EyeOff, 
  FileText, 
  KeyRound, 
  Image as ImageIcon, 
  Link2,
  Code2, 
  Clipboard, 
  AlertCircle, 
  Loader2, 
  BookOpen, 
  CheckSquare, 
  Square,
  Plus,
  Trash2,
  RefreshCw,
  ArrowUpRight,
  ExternalLink,
  Edit3
} from 'lucide-react';
import { ItemType, SavedItem, Folder, ChecklistItem } from '../types';
import { sound } from '../utils/sound';
import { parseSocialUrl } from '../utils/storage';
import { fetchLinkPreview, getImmediateLinkPreview, LinkPreviewData, normalizeUrl, isDirectImageUrl } from '../utils/fetchPreview';
import { findDuplicateItem, readClipboardSafely } from '../utils/clipboard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FolderDropdown } from './FolderDropdown';
import { InstagramIcon, RedditIcon, XIcon } from './Icons';

interface CaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: SavedItem, enrichPreview?: boolean) => void;
  existingItems: SavedItem[];
  folders: Folder[];
  onCreateFolder?: (name: string) => Folder;
  isDark?: boolean;
  initialType?: ItemType;
  initialFolderId?: string;
  initialContent?: string;
  initialTitle?: string;
}

// Cryptographically secure password generator
function generateSecurePassword(length = 20, includeSymbols = true, includeNumbers = true): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  let chars = letters;
  if (includeNumbers) chars += numbers;
  if (includeSymbols) chars += symbols;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join('');
}

// Calculate password strength
function getPasswordStrength(pwd: string): { label: string; score: number } {
  if (!pwd) return { label: 'Empty', score: 0 };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 14) score += 1;
  if (pwd.length >= 20) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

  if (score <= 1) return { label: 'Weak', score: 1 };
  if (score <= 3) return { label: 'Good', score: 2 };
  if (score <= 4) return { label: 'Strong', score: 3 };
  return { label: 'Very Strong', score: 4 };
}

const SUGGESTED_TAGS = ['dev', 'design', 'inspiration', 'reading', 'tools', 'skill'];

export const CaptureSheet: React.FC<CaptureSheetProps> = ({
  isOpen,
  onClose,
  onSave,
  existingItems,
  folders,
  onCreateFolder,
  isDark = true,
  initialType = 'note',
  initialFolderId,
  initialContent = '',
  initialTitle = '',
}) => {
  const [type, setType] = useState<ItemType>(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [secondaryNote, setSecondaryNote] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(initialFolderId);
  const [isPinned, setIsPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Mobile view toggle (Editor vs Live Card)
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  // Note Checklist Mode
  const [isChecklistMode, setIsChecklistMode] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Secret Generator
  const [showSecret, setShowSecret] = useState(false);
  const [secretLength, setSecretLength] = useState(20);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [secretCategory, setSecretCategory] = useState<'password' | 'api_key' | 'token' | 'wifi' | 'other'>('password');

  // Code Language
  const [codeLanguage, setCodeLanguage] = useState('typescript');

  // Preview data for links & socials
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [duplicateItem, setDuplicateItem] = useState<SavedItem | null>(null);
  const [clipboardSuggestion, setClipboardSuggestion] = useState<string | null>(null);
  const [autoDetectedBadge, setAutoDetectedBadge] = useState<string | null>(null);
  const fetchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewVersion = React.useRef(0);
  const reduceMotion = useReducedMotion();
  const [formError, setFormError] = useState('');

  // Markdown write/render tab
  const [markdownTab, setMarkdownTab] = useState<'write' | 'render'>('write');

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setTitle(initialTitle || '');
      setContent(initialContent || '');
      setSecondaryNote('');
      setSelectedFolderId(initialFolderId);
      setIsPinned(false);
      setTags([]);
      setTagInput('');
      setIsChecklistMode(false);
      setChecklistItems([]);
      setShowSecret(false);
      previewVersion.current += 1;
      setIsFetchingPreview(false);
      setFormError('');
      setPreviewData(null);
      setDuplicateItem(null);
      setAutoDetectedBadge(null);
      setMobileTab('editor');
      setMarkdownTab('write');
      requestAnimationFrame(() => (document.getElementById('capture-url') || document.getElementById('capture-title'))?.focus());


      if (initialContent) {
        handleContentChange(initialContent);
      } else {
        readClipboardSafely().then((res) => {
          if (res.text && res.text.length > 3) {
            setClipboardSuggestion(res.text);
          }
        });
      }
    } else {
      previewVersion.current += 1;
      document.body.style.overflow = '';
      setClipboardSuggestion(null);
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }
    return () => {
      document.body.style.overflow = '';
      previewVersion.current += 1;
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [isOpen, initialType, initialFolderId, initialContent, initialTitle]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isOpen) {
        e.preventDefault();
        handleSubmit(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, content, title, secondaryNote, type, isPinned, selectedFolderId, previewData, checklistItems, tags]);

  // Omni-Input Auto-Detection
  const handleContentChange = (val: string) => {
    setContent(val);
    previewVersion.current += 1;
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = null;
    setIsFetchingPreview(false);
    setPreviewData(null);
    setFormError('');

    const dup = findDuplicateItem(val, existingItems);
    setDuplicateItem(dup);

    const trimmed = val.trim();
    if (!trimmed) {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      return;
    }

    const isWebUrl = (() => {
      try { return new URL(normalizeUrl(trimmed)).hostname.includes('.'); }
      catch { return false; }
    })();

    // Direct Image URL detection
    if (isWebUrl && isDirectImageUrl(trimmed)) {
      if (type !== 'image' && type !== 'link') {
        setType('link');
        setAutoDetectedBadge('Image Link');
      }
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      setPreviewData(getImmediateLinkPreview(trimmed));
      triggerFetchPreview(trimmed);
      return;
    }

    // Check for social URLs
    const social = parseSocialUrl(trimmed);
    if (isWebUrl && social.detectedType !== 'link') {
      setType(social.detectedType);
      setAutoDetectedBadge(
        social.detectedType === 'x_post' ? 'X Post' :
        social.detectedType === 'reddit_post' ? 'Reddit' :
        social.detectedType === 'instagram_post' ? 'Instagram' : 'Social'
      );
      if (social.extractedInfo?.title && !title) {
        setTitle(social.extractedInfo.title);
      }
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      setPreviewData(getImmediateLinkPreview(trimmed));
      fetchTimerRef.current = setTimeout(() => triggerFetchPreview(trimmed), 200);
      return;
    }

    // Check for standard web URL (robust hostname test supporting any query parameters/paths)
    const isUrl = (() => {
      if (trimmed.includes('\n') || trimmed.includes(' ')) return false;
      try {
        const u = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
        const parsed = new URL(u);
        return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.hostname.includes('.') && parsed.hostname.length > 3;
      } catch {
        return false;
      }
    })();

    if (isUrl) {
      if (type !== 'link' && type !== 'x_post' && type !== 'reddit_post' && type !== 'instagram_post') {
        setType('link');
        setAutoDetectedBadge('Smart Web Link');
      }
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      setPreviewData(getImmediateLinkPreview(trimmed));
      fetchTimerRef.current = setTimeout(() => triggerFetchPreview(trimmed), 200);
      return;
    }

    // Check for Markdown document (# Heading or ``` code)
    if (type === 'note' && (trimmed.startsWith('# ') || trimmed.includes('```') || trimmed.startsWith('## '))) {
      setType('markdown');
      setAutoDetectedBadge('Markdown Document');
      return;
    }

    // Check for API Key / Token patterns (e.g. sk-, ghp_, Bearer, key-)
    if (type === 'note' && (/^(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|ey[a-zA-Z0-9_-]{20,})/.test(trimmed))) {
      setType('secret');
      setSecretCategory('api_key');
      setAutoDetectedBadge('API Key / Token');
      return;
    }
  };

  const triggerFetchPreview = async (urlStr: string, forceFresh: boolean = false) => {
    const cleanUrl = urlStr.trim();
    if (!cleanUrl) return;
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = null;
    const version = ++previewVersion.current;
    setIsFetchingPreview(true);
    try {
      const data = await fetchLinkPreview(cleanUrl, forceFresh);
      if (version === previewVersion.current) setPreviewData(data);
    } catch {
      if (version === previewVersion.current) setFormError('Use a valid http or https link.');
    } finally {
      if (version === previewVersion.current) setIsFetchingPreview(false);
    }
  };

  const handleApplyClipboard = () => {
    if (!clipboardSuggestion) return;
    sound.pop();
    handleContentChange(clipboardSuggestion);
    setClipboardSuggestion(null);
  };

  // Tag management
  const handleAddTag = (t: string) => {
    const clean = t.trim().replace(/^#/, '').toLowerCase();
    if (!clean || tags.includes(clean)) return;
    sound.click();
    setTags([...tags, clean]);
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    sound.click();
    setTags(tags.filter((x) => x !== t));
  };

  // Checklist management
  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    sound.pop();
    setChecklistItems([
      ...checklistItems,
      { id: `c-${Date.now()}-${Math.random()}`, text: newChecklistText.trim(), completed: false },
    ]);
    setNewChecklistText('');
  };

  const handleToggleChecklistItem = (id: string) => {
    sound.click();
    setChecklistItems(
      checklistItems.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleDeleteChecklistItem = (id: string) => {
    sound.click();
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  // One-click quick presets
  const applyPreset = (preset: 'note' | 'todo' | 'skill' | 'password' | 'code') => {
    sound.pop();
    if (preset === 'note') {
      setType('note');
      setIsChecklistMode(false);
      setTitle('');
      setContent('');
    } else if (preset === 'todo') {
      setType('note');
      setIsChecklistMode(true);
      setTitle('To-Do List');
      if (checklistItems.length === 0) {
        setChecklistItems([
          { id: '1', text: 'Define key tasks and priorities', completed: false },
          { id: '2', text: 'Refine micro-interactions and animations', completed: false },
        ]);
      }
    } else if (preset === 'skill') {
      setType('markdown');
      setTitle('Creative System Prompt');
      setContent(
`# Creative Designer & Architect

> High-craft aesthetic prompt with focus on minimalism, restraint, and tactile feedback.

## Guidelines
- Follow Swiss-style layout principles
- Never use rainbow gradients or unearned emojis
- Ensure zero-friction user workflows`
      );
      if (!tags.includes('skill')) setTags([...tags, 'skill']);
    } else if (preset === 'password') {
      setType('secret');
      setSecretCategory('password');
      setTitle('Master Key');
      const generated = generateSecurePassword(24, true, true);
      setContent(generated);
    } else if (preset === 'code') {
      setType('code');
      setTitle('Fluid Spring Transition');
      setCodeLanguage('typescript');
      setContent(
`export const fluidSpring = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};`
      );
    }
  };

  const handleGeneratePassword = () => {
    sound.pop();
    const pwd = generateSecurePassword(secretLength, includeSymbols, includeNumbers);
    setContent(pwd);
  };

  // Image Upload
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sound.pop();
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setContent(result);
      setType('image');
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e?: React.FormEvent | KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && !title.trim() && checklistItems.length === 0) return;

    if (['link', 'x_post', 'reddit_post', 'instagram_post'].includes(type)) {
      try {
        const parsed = new URL(normalizeUrl(content));
        if (!parsed.hostname.includes('.')) throw new Error('Invalid URL');
      } catch {
        setFormError('Add a valid web link before saving.');
        return;
      }
    }

    const base = {
      id: `item-${Date.now()}`,
      title: title.trim() || 'Untitled',
      createdAt: Date.now(),
      isPinned,
      tags,
      folderId: selectedFolderId,
    };

    let newItem: SavedItem;

    if (type === 'x_post') {
      const social = parseSocialUrl(content);
      const handleFromUrl = content.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/)?.[1];
      const authorHandle = previewData?.authorHandle || (handleFromUrl ? `@${handleFromUrl}` : (social.extractedInfo?.handle ? `@${social.extractedInfo.handle}` : '@author'));
      const authorName = previewData?.author || (title && title !== 'Untitled' ? title : (handleFromUrl || social.extractedInfo?.handle || 'Creator'));
      const tweetBody = secondaryNote || previewData?.description || (content.startsWith('http') ? 'Post on X' : content);

      newItem = {
        ...base,
        type: 'x_post',
        authorName,
        authorHandle,
        authorAvatar: previewData?.authorAvatar || `https://unavatar.io/x/${authorHandle.replace(/^@/, '')}`,
        content: tweetBody,
        postUrl: content || 'https://x.com',
        imageUrl: previewData?.imageUrl,
        likes: previewData?.likes,
        reposts: previewData?.reposts,
      };
    } else if (type === 'reddit_post') {
      const social = parseSocialUrl(content);
      const redditBody = secondaryNote || previewData?.description || (content.startsWith('http') ? 'Discussion on Reddit' : content);
      newItem = {
        ...base,
        type: 'reddit_post',
        subreddit: social.extractedInfo?.subreddit ? `r/${social.extractedInfo.subreddit}` : (previewData?.publisher || 'r/reddit'),
        author: previewData?.author || 'u/community',
        title: title || previewData?.title || social.extractedInfo?.title || 'Reddit Post',
        content: redditBody,
        postUrl: content || 'https://reddit.com',
        upvotes: 480,
        commentsCount: 64,
        imageUrl: previewData?.imageUrl,
      };
    } else if (type === 'instagram_post') {
      const social = parseSocialUrl(content);
      const handleFromUrl = content.match(/instagram\.com\/(?:p|reel|([a-zA-Z0-9_.]+))/)?.[1];
      newItem = {
        ...base,
        type: 'instagram_post',
        handle: previewData?.authorHandle || (handleFromUrl ? `@${handleFromUrl}` : (social.extractedInfo?.handle ? `@${social.extractedInfo.handle}` : '@instagram')),
        caption: secondaryNote || title || previewData?.description || 'Instagram Visual',
        imageUrl: previewData?.imageUrl || (content.startsWith('http') ? content : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'),
        postUrl: content.startsWith('http') ? content : undefined,
      };
    } else if (type === 'secret') {
      newItem = {
        ...base,
        type: 'secret',
        category: secretCategory,
        title: title || 'Secret Key',
        secretValue: content,
        username: secondaryNote || undefined,
      };
    } else if (type === 'image') {
      newItem = {
        ...base,
        type: 'image',
        title: title || 'Visual',
        imageUrl: content,
        caption: secondaryNote || undefined,
      };
    } else if (type === 'code') {
      newItem = {
        ...base,
        type: 'code',
        title: title || 'Code Snippet',
        code: content,
        language: codeLanguage,
      };
    } else if (type === 'markdown') {
      newItem = {
        ...base,
        type: 'markdown',
        title: title || (content.split('\n')[0].replace(/^#+\s*/, '') || 'Markdown Document'),
        content,
        isSkill: content.toLowerCase().includes('skill') || title.toLowerCase().includes('skill') || tags.includes('skill'),
      };
    } else {
      const isUrl = (() => {
        const tr = content.trim();
        if (tr.includes('\n') || tr.includes(' ')) return false;
        try {
          const u = tr.startsWith('http://') || tr.startsWith('https://') ? tr : `https://${tr}`;
          const parsed = new URL(u);
          return parsed.hostname.includes('.') && parsed.hostname.length > 3;
        } catch {
          return false;
        }
      })();

      if (isUrl || type === 'link') {
        const fullUrl = normalizeUrl(content);
        let domain = 'link';
        try {
          domain = new URL(fullUrl).hostname.replace(/^www\./, '');
        } catch {
          domain = 'link';
        }

        const immediate = getImmediateLinkPreview(fullUrl);

        newItem = {
          ...base,
          type: 'link',
          title: title || previewData?.title || domain,
          url: fullUrl,
          domain: previewData?.domain || domain,
          description: secondaryNote || previewData?.description || undefined,
          previewImage: previewData ? previewData.imageUrl : immediate.imageUrl,
          favicon: previewData?.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        };
      } else {
        newItem = {
          ...base,
          type: 'note',
          title: title || (isChecklistMode ? 'To-Do List' : 'Note'),
          content,
          checklist: isChecklistMode ? checklistItems : undefined,
          typography: 'sans',
        };
      }
    }

    sound.save();
    onSave(newItem, isFetchingPreview || fetchTimerRef.current !== null);
    onClose();
  };

  const typeOptions: { id: ItemType; label: string; icon: React.ReactNode }[] = [
    { id: 'note', label: 'Note', icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'link', label: 'Link', icon: <Link2 className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'x_post', label: 'X Post', icon: <XIcon className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'markdown', label: 'Markdown', icon: <BookOpen className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'secret', label: 'Secret', icon: <KeyRound className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'code', label: 'Code', icon: <Code2 className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'image', label: 'Image', icon: <ImageIcon className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'reddit_post', label: 'Reddit', icon: <RedditIcon className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'instagram_post', label: 'Instagram', icon: <InstagramIcon className="w-3.5 h-3.5 shrink-0" /> },
  ];

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const passwordStrength = useMemo(() => getPasswordStrength(content), [content]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          aria-labelledby="capture-heading"
          initial={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateX(24px)' }}
          animate={{ opacity: 1, transform: 'translateX(0px)' }}
          exit={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateX(24px)' }}
          transition={{ duration: reduceMotion ? 0.1 : 0.2, ease: [0.32, 0.72, 0, 1] }}
          className={`capture-screen ${type === 'link' ? 'capture-link-screen' : ''}`}
        >
          {/* Top Bar */}
          <div className={`capture-header px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'border-white/[0.08] bg-[#101012]' : 'border-zinc-200/80 bg-zinc-50/50'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span id="capture-heading" className="font-bold text-base sm:text-lg tracking-tight text-zinc-950 dark:text-white">
                {type === 'link' ? 'Save a link' : 'Capture'}
              </span>

              {autoDetectedBadge && (
                <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1.5 ${
                  isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-zinc-100 text-zinc-800 border-zinc-300'
                }`}>
                  <Sparkles className="w-3 h-3 text-zinc-400" />
                  <span>{autoDetectedBadge}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {type !== 'link' && <button
                type="button"
                onClick={() => setMobileTab(mobileTab === 'editor' ? 'preview' : 'editor')}
                aria-pressed={mobileTab === 'preview'} aria-controls="capture-live-preview"
                className="capture-preview-toggle">
                {mobileTab === 'preview' ? <Edit3 size={14} /> : <Eye size={14} />}
                <span>{mobileTab === 'preview' ? 'Edit' : 'Preview'}</span>
              </button>}

              {/* Folder Selector */}
              <FolderDropdown
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(id) => setSelectedFolderId(id || undefined)}
                onCreateFolder={onCreateFolder}
                isDark={isDark}
                emptyLabel="No Folder"
              />

              {/* Pin Toggle */}
              <button
                type="button"
                onClick={() => {
                  sound.pin();
                  setIsPinned(!isPinned);
                }}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isPinned
                    ? (isDark ? 'bg-white text-zinc-950 border-white font-semibold' : 'bg-zinc-950 text-white border-zinc-950')
                    : (isDark ? 'text-zinc-400 hover:text-white border-zinc-800 hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-950 border-zinc-200 hover:bg-zinc-100')
                }`}
                title={isPinned ? 'Pinned to top' : 'Pin to top'}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  onClose();
                }}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Full-Width 9 Type Ribbon: ZERO horizontal scroll, completely visible */}
          <div className={`capture-types px-6 py-3 border-b shrink-0 ${
            isDark ? 'border-white/[0.07] bg-[#121215]' : 'border-zinc-200/80 bg-zinc-50/40'
          }`}>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 w-full">
              {typeOptions.map((opt) => {
                const isActive = type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      sound.click();
                      setType(opt.id);
                      setMobileTab('editor');
                    }}
                    className={`relative w-full py-2 px-1.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none border ${
                      isActive
                        ? (isDark 
                            ? 'bg-zinc-100 text-zinc-950 font-semibold border-white shadow-xs' 
                            : 'bg-zinc-950 text-white font-semibold border-zinc-950 shadow-xs')
                        : (isDark 
                            ? 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 font-medium' 
                            : 'border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 font-medium')
                    }`}
                  >
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Workstation Body: Dual-Pane on Desktop, Tabbed on Mobile */}
          <div className="capture-content flex min-h-0">
            {/* Left Pane: Authoring & Inputs */}
            <div className={`capture-fields flex-1 p-6 flex flex-col gap-6 min-w-0 ${
              mobileTab === 'preview' && type !== 'link' ? 'hidden' : 'flex'
            }`}>
              <div className="space-y-3.5">
                {/* Clipboard Notification Banner */}
                {clipboardSuggestion && !content && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`px-3.5 py-2.5 rounded-2xl text-xs flex items-center justify-between gap-3 border ${
                      isDark 
                        ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <Clipboard className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate text-xs">
                        Clipboard: <em className="font-mono">{clipboardSuggestion.slice(0, 48)}...</em>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyClipboard}
                      className={`px-3 py-1 rounded-xl text-xs font-medium cursor-pointer transition-all shrink-0 ${
                        isDark ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-black'
                      }`}
                    >
                      Quick Paste
                    </button>
                  </motion.div>
                )}

                {/* Duplicate Notice */}
                {duplicateItem && (
                  <div className={`px-3.5 py-2 rounded-2xl text-xs flex items-center gap-2 border ${
                    isDark 
                      ? 'bg-amber-950/30 border-amber-800/40 text-amber-200' 
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="truncate">
                      Already saved: <strong>{duplicateItem.title}</strong>
                    </span>
                  </div>
                )}

                {/* Title Input */}
                {type !== 'link' && type !== 'note' && <input
                  id="capture-title"
                  autoFocus
                  aria-label="Item title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === 'markdown' ? 'Document or Skill Name...' :
                    type === 'secret' ? 'Secret Name (e.g. GitHub Token, Wi-Fi)...' :
                    type === 'code' ? 'Snippet Title...' :
                    type === 'x_post' ? 'Topic / Title (optional)...' :
                    type === 'reddit_post' ? 'Reddit Title...' :
                    'Title (optional)...'
                  }
                  className={`w-full text-xl sm:text-2xl font-bold tracking-tight bg-transparent focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-colors ${
                    isDark ? 'text-zinc-50' : 'text-zinc-950'
                  }`}
                />}

                {/* Mode-Specific Content Area */}
                {type === 'x_post' ? (
                  /* X Post Studio */
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <XIcon className="w-3 h-3" />
                          <span>Status / Post URL</span>
                        </span>
                        {isFetchingPreview && (
                          <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Fetching live tweet...</span>
                          </span>
                        )}
                      </div>

                      <div className="relative flex items-center">
                        <input
                          type="url"
                          value={content}
                          onChange={(e) => handleContentChange(e.target.value)}
                          placeholder="https://x.com/username/status/123456789..."
                          className={`w-full pl-3.5 pr-20 py-2.5 rounded-2xl text-xs font-mono border bg-transparent focus:outline-none placeholder:text-zinc-400 transition-colors ${
                            isDark ? 'border-zinc-800 text-white bg-zinc-900/40' : 'border-zinc-200 text-zinc-900 bg-zinc-50'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (content.trim()) triggerFetchPreview(content.trim());
                          }}
                          disabled={!content.trim() || isFetchingPreview}
                          className={`absolute right-1.5 px-3 py-1 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                            isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <RefreshCw className={`w-3 h-3 ${isFetchingPreview ? 'animate-spin' : ''}`} />
                          <span>Fetch</span>
                        </button>
                      </div>
                    </div>

                    {/* Author Meta Row */}
                    {(previewData?.author || previewData?.authorHandle || isFetchingPreview) && (
                      <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                        isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                      }`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {previewData?.authorAvatar ? (
                            <img
                              src={previewData.authorAvatar}
                              alt={previewData.author || 'Author'}
                              className="w-7 h-7 rounded-full object-cover bg-zinc-800 border border-zinc-700/50 shrink-0"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-white shrink-0">
                              <XIcon className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold truncate leading-tight">
                              {previewData?.author || 'Creator'}
                            </p>
                            <p className="text-[11px] text-zinc-400 font-mono leading-tight">
                              {previewData?.authorHandle || '@author'}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                          isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-200 text-zinc-700 border-zinc-300'
                        }`}>
                          X link
                        </span>
                      </div>
                    )}

                    {/* Tweet Content Textarea */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span>Tweet Content</span>
                        <span>{secondaryNote.length} characters</span>
                      </div>

                      <textarea
                        rows={6}
                        value={secondaryNote}
                        onChange={(e) => setSecondaryNote(e.target.value)}
                        placeholder={
                          isFetchingPreview 
                            ? 'Fetching tweet text automatically...' 
                            : 'Tweet text auto-populates here, or type/edit notes...'
                        }
                        className={`w-full p-4 rounded-2xl text-xs border bg-transparent focus:outline-none resize-none leading-relaxed transition-colors ${
                          isDark 
                            ? 'border-zinc-800 text-zinc-200 bg-zinc-900/30 placeholder:text-zinc-500' 
                            : 'border-zinc-200 text-zinc-800 bg-zinc-50/50 placeholder:text-zinc-400'
                        }`}
                      />
                    </div>
                  </div>
                ) : type === 'link' ? (
                  <div className="capture-link-entry">
                    <label className="capture-link-label" htmlFor="capture-url">Paste a link</label>
                    <div className="capture-url-field">
                      <Link2 size={17} aria-hidden="true" />
                      <input id="capture-url" type="url" autoFocus value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        placeholder="https://…" autoComplete="off" spellCheck={false} />
                      {content.trim() && <button type="button" aria-label="Refresh link preview"
                        onClick={() => triggerFetchPreview(content, true)} disabled={isFetchingPreview}>
                        <RefreshCw size={15} className={isFetchingPreview ? 'animate-spin' : ''} />
                      </button>}
                    </div>

                    {previewData ? (
                      <div className="capture-link-result">
                        <div className="capture-link-cover">
                          {previewData.imageUrl ? <img key={previewData.imageUrl} src={previewData.imageUrl} alt="Page cover"
                            onError={() => setPreviewData(prev => prev ? { ...prev, imageUrl: undefined, error: 'The page cover could not load.' } : null)} />
                            : <div className="capture-cover-placeholder">
                                {isFetchingPreview ? <Loader2 size={24} className="animate-spin" /> : <Link2 size={24} />}
                                <span>{isFetchingPreview ? 'Loading preview' : 'No cover available'}</span>
                              </div>}
                        </div>
                        <div className="capture-link-copy">
                          <span>{previewData.domain}</span>
                          <h2>{title || previewData.title}</h2>
                          <p>{previewData.description || (isFetchingPreview ? 'Getting the page details. You can save right away.' : 'Keep this link in your collection.')}</p>
                        </div>
                      </div>
                    ) : <p className="capture-link-empty">An article, a useful tool, your next rabbit hole. Keep it here.</p>}
                    <p className="capture-link-status" role="status">
                      {isFetchingPreview ? 'Getting page details in the background…' : previewData?.error || (previewData ? 'Ready to save' : '')}
                    </p>

                    <details className="capture-link-options">
                      <summary>Add a title or personal note <span>Optional</span></summary>
                      <label htmlFor="capture-title">Title</label>
                      <input id="capture-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={previewData?.title || 'Give it a title'} />
                      <label htmlFor="capture-link-note">Your note</label>
                      <textarea id="capture-link-note" rows={3} value={secondaryNote} onChange={(e) => setSecondaryNote(e.target.value)} placeholder="Why are you keeping this?" />
                      {previewData?.imageUrl && <button type="button" onClick={() => setPreviewData(prev => prev ? { ...prev, imageUrl: undefined } : null)}>Remove cover image</button>}
                    </details>
                  </div>
                ) : type === 'reddit_post' ? (
                  /* Reddit Post Studio */
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Reddit Thread URL
                        </span>
                        {isFetchingPreview && (
                          <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Fetching thread...</span>
                          </span>
                        )}
                      </div>

                      <div className="relative flex items-center">
                        <input
                          type="url"
                          value={content}
                          onChange={(e) => handleContentChange(e.target.value)}
                          placeholder="https://reddit.com/r/subreddit/comments/..."
                          className={`w-full pl-3.5 pr-20 py-2.5 rounded-2xl text-xs font-mono border bg-transparent focus:outline-none placeholder:text-zinc-400 transition-colors ${
                            isDark ? 'border-zinc-800 text-white bg-zinc-900/40' : 'border-zinc-200 text-zinc-900 bg-zinc-50'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (content.trim()) triggerFetchPreview(content.trim());
                          }}
                          disabled={!content.trim() || isFetchingPreview}
                          className={`absolute right-1.5 px-3 py-1 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                            isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <RefreshCw className={`w-3 h-3 ${isFetchingPreview ? 'animate-spin' : ''}`} />
                          <span>Fetch</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={6}
                      value={secondaryNote}
                      onChange={(e) => setSecondaryNote(e.target.value)}
                      placeholder="Thread excerpt, discussion takeaways or commentary..."
                      className={`w-full p-4 rounded-2xl text-xs border bg-transparent focus:outline-none resize-none leading-relaxed transition-colors ${
                        isDark ? 'border-zinc-800 text-zinc-200 bg-zinc-900/30' : 'border-zinc-200 text-zinc-800 bg-zinc-50/50'
                      }`}
                    />
                  </div>
                ) : type === 'instagram_post' ? (
                  /* Instagram Post Studio */
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Instagram Post URL
                        </span>
                        {isFetchingPreview && (
                          <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Fetching post...</span>
                          </span>
                        )}
                      </div>

                      <div className="relative flex items-center">
                        <input
                          type="url"
                          value={content}
                          onChange={(e) => handleContentChange(e.target.value)}
                          placeholder="https://instagram.com/p/..."
                          className={`w-full pl-3.5 pr-20 py-2.5 rounded-2xl text-xs font-mono border bg-transparent focus:outline-none placeholder:text-zinc-400 transition-colors ${
                            isDark ? 'border-zinc-800 text-white bg-zinc-900/40' : 'border-zinc-200 text-zinc-900 bg-zinc-50'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (content.trim()) triggerFetchPreview(content.trim());
                          }}
                          disabled={!content.trim() || isFetchingPreview}
                          className={`absolute right-1.5 px-3 py-1 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                            isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <RefreshCw className={`w-3 h-3 ${isFetchingPreview ? 'animate-spin' : ''}`} />
                          <span>Fetch</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={6}
                      value={secondaryNote}
                      onChange={(e) => setSecondaryNote(e.target.value)}
                      placeholder="Visual notes or caption..."
                      className={`w-full p-4 rounded-2xl text-xs border bg-transparent focus:outline-none resize-none leading-relaxed transition-colors ${
                        isDark ? 'border-zinc-800 text-zinc-200 bg-zinc-900/30' : 'border-zinc-200 text-zinc-800 bg-zinc-50/50'
                      }`}
                    />
                  </div>
                ) : type === 'markdown' ? (
                  /* Markdown Studio */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => applyPreset('skill')}
                        className="px-3 py-1.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Load Skill Template</span>
                      </button>

                      <div className="flex items-center p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setMarkdownTab('write')}
                          className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                            markdownTab === 'write'
                              ? (isDark ? 'bg-zinc-800 text-white font-medium' : 'bg-zinc-200 text-zinc-900 font-medium')
                              : 'text-zinc-400'
                          }`}
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarkdownTab('render')}
                          className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                            markdownTab === 'render'
                              ? (isDark ? 'bg-zinc-800 text-white font-medium' : 'bg-zinc-200 text-zinc-900 font-medium')
                              : 'text-zinc-400'
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {markdownTab === 'write' ? (
                      <textarea
                        rows={9}
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        placeholder="Write or paste markdown documents, skills, guidelines (# Heading, - list, ```code)..."
                        className={`w-full p-4 rounded-2xl text-xs font-mono border bg-transparent focus:outline-none resize-none leading-relaxed transition-colors ${
                          isDark ? 'border-zinc-800 text-zinc-200 bg-zinc-900/40' : 'border-zinc-200 text-zinc-800 bg-zinc-50'
                        }`}
                      />
                    ) : (
                      <div className={`p-4 rounded-2xl border max-h-72 overflow-y-auto ${
                        isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-200 bg-zinc-50'
                      }`}>
                        <MarkdownRenderer content={content || '*No markdown content to preview yet*'} isDark={isDark} />
                      </div>
                    )}
                  </div>
                ) : type === 'secret' ? (
                  /* Secret Studio */
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-zinc-400 mr-1">Type:</span>
                      {(['password', 'api_key', 'token', 'wifi', 'other'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            sound.click();
                            setSecretCategory(cat);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-xs capitalize transition-colors cursor-pointer ${
                            secretCategory === cat
                              ? (isDark ? 'bg-zinc-800 text-white font-medium' : 'bg-zinc-200 text-zinc-900 font-medium')
                              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                          }`}
                        >
                          {cat.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    <div className={`p-4 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Secret Key / Value
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                          title={showSecret ? 'Hide secret' : 'Show secret'}
                        >
                          {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Enter secret, token, or password..."
                        className={`w-full text-sm font-mono bg-transparent focus:outline-none placeholder:text-zinc-400 ${
                          isDark ? 'text-white' : 'text-zinc-900'
                        }`}
                      />

                      {/* Generator bar */}
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 font-mono text-[11px]">Len: {secretLength}</span>
                          <input
                            type="range"
                            min="8"
                            max="48"
                            value={secretLength}
                            onChange={(e) => {
                              setSecretLength(Number(e.target.value));
                              const pwd = generateSecurePassword(Number(e.target.value), includeSymbols, includeNumbers);
                              setContent(pwd);
                            }}
                            className="w-24 accent-zinc-800 dark:accent-zinc-200 cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 text-[11px]">Strength:</span>
                          <span className={`font-mono text-[11px] font-medium ${
                            passwordStrength.score >= 3 ? 'text-emerald-500' :
                            passwordStrength.score === 2 ? 'text-amber-500' : 'text-zinc-400'
                          }`}>
                            {passwordStrength.label}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="px-2.5 py-1 rounded-xl text-xs border border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Generate</span>
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={secondaryNote}
                      onChange={(e) => setSecondaryNote(e.target.value)}
                      placeholder="Username, account identifier, or notes (optional)..."
                      className={`w-full px-3.5 py-2.5 rounded-2xl text-xs border bg-transparent focus:outline-none placeholder:text-zinc-400 transition-colors ${
                        isDark ? 'border-zinc-800 text-white' : 'border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>
                ) : type === 'code' ? (
                  /* Code Studio */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 font-mono">Syntax Language:</span>
                      <select
                        value={codeLanguage}
                        onChange={(e) => setCodeLanguage(e.target.value)}
                        className={`text-xs px-3 py-1.5 rounded-xl border bg-transparent focus:outline-none cursor-pointer ${
                          isDark ? 'border-zinc-800 text-zinc-300' : 'border-zinc-200 text-zinc-800'
                        }`}
                      >
                        <option value="typescript">TypeScript</option>
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="rust">Rust</option>
                        <option value="go">Go</option>
                        <option value="css">CSS / Tailwind</option>
                        <option value="html">HTML</option>
                        <option value="bash">Bash / Shell</option>
                        <option value="json">JSON</option>
                        <option value="sql">SQL</option>
                      </select>
                    </div>

                    <textarea
                      rows={8}
                      value={content}
                      onChange={(e) => handleContentChange(e.target.value)}
                      placeholder="Paste or write code snippet..."
                      className={`w-full p-4 rounded-2xl text-xs font-mono border bg-transparent focus:outline-none resize-none leading-relaxed transition-colors ${
                        isDark ? 'border-zinc-800 text-zinc-200 bg-zinc-900/40' : 'border-zinc-200 text-zinc-800 bg-zinc-50'
                      }`}
                    />
                  </div>
                ) : type === 'image' ? (
                  /* Image Studio */
                  <div className="space-y-3">
                    <div className={`p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center transition-colors ${
                      isDark ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30' : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50'
                    }`}>
                      {content ? (
                        <div className="relative group w-full flex flex-col items-center">
                          <img
                            src={content}
                            alt="Upload preview"
                            className="max-h-48 rounded-xl object-contain shadow-md mb-2"
                          />
                          <button
                            type="button"
                            onClick={() => setContent('')}
                            className="px-3 py-1 rounded-lg text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 cursor-pointer"
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-zinc-400 mb-2 stroke-[1.5]" />
                          <label className="text-xs font-semibold cursor-pointer text-zinc-800 dark:text-zinc-200 hover:underline mb-1">
                            Choose an image file
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFile}
                              className="hidden"
                            />
                          </label>
                          <p className="text-[11px] text-zinc-400">PNG, JPG, WebP, GIF or paste image URL below</p>
                        </>
                      )}
                    </div>

                    <input
                      type="text"
                      value={content.startsWith('data:') ? '' : content}
                      onChange={(e) => handleContentChange(e.target.value)}
                      placeholder="Or paste direct image URL (https://...)..."
                      className={`w-full px-3.5 py-2.5 rounded-2xl text-xs border bg-transparent focus:outline-none placeholder:text-zinc-400 transition-colors ${
                        isDark ? 'border-zinc-800 text-white' : 'border-zinc-200 text-zinc-900'
                      }`}
                    />

                    <input
                      type="text"
                      value={secondaryNote}
                      onChange={(e) => setSecondaryNote(e.target.value)}
                      placeholder="Caption or visual note (optional)..."
                      className={`w-full px-3.5 py-2.5 rounded-2xl text-xs border bg-transparent focus:outline-none placeholder:text-zinc-400 transition-colors ${
                        isDark ? 'border-zinc-800 text-white' : 'border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>
                ) : (
                  /* Note & Checklist Studio */
                  <div className="capture-note-composer">
                    {type === 'note' && <input id="capture-title" type="text" autoFocus aria-label="Note title"
                      value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled note" />}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{isChecklistMode ? 'Checklist' : 'Your note'}</span>
                      <button
                        type="button"
                        onClick={() => setIsChecklistMode(!isChecklistMode)}
                        className={`px-3 py-1 rounded-xl text-xs border transition-colors cursor-pointer flex items-center gap-1.5 ${
                          isChecklistMode
                            ? (isDark ? 'bg-zinc-800 text-white border-zinc-700 font-medium' : 'bg-zinc-200 text-zinc-900 border-zinc-300 font-medium')
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{isChecklistMode ? 'Checklist Active' : 'Checklist'}</span>
                      </button>
                    </div>

                    {isChecklistMode ? (
                      <div className="space-y-2">
                        <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                          {checklistItems.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border text-xs ${
                                isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleChecklistItem(item.id)}
                                className="cursor-pointer text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                              >
                                {item.completed ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                              <span className={`flex-1 truncate ${item.completed ? 'line-through text-zinc-400' : ''}`}>
                                {item.text}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteChecklistItem(item.id)}
                                className="text-zinc-400 hover:text-red-500 cursor-pointer p-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={newChecklistText}
                            onChange={(e) => setNewChecklistText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddChecklistItem();
                              }
                            }}
                            placeholder="Add new task (press Enter)..."
                            className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs border bg-transparent focus:outline-none placeholder:text-zinc-400 ${
                              isDark ? 'border-zinc-800 text-white' : 'border-zinc-200 text-zinc-900'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={handleAddChecklistItem}
                            className={`p-2.5 rounded-xl border cursor-pointer ${
                              isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            <Plus className="w-4 h-4 text-zinc-400" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        id="capture-note-content"
                        aria-label="Note content"
                        rows={7}
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        placeholder="Write a thought, note, idea, or paste anything..."
                        className={`w-full p-4 rounded-2xl text-xs border bg-transparent focus:outline-none resize-none leading-relaxed transition-colors ${
                          isDark ? 'border-zinc-800 text-zinc-200 bg-zinc-900/40' : 'border-zinc-200 text-zinc-800 bg-zinc-50'
                        }`}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Tags Row */}
              <div className={`capture-tags pt-2 space-y-1.5 shrink-0 ${
                isDark ? 'border-white/[0.08]' : 'border-zinc-200/80'
              }`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className={`inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                        isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-zinc-100 text-zinc-800 border-zinc-200'
                      }`}
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-red-500 cursor-pointer ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}

                  <div className="inline-flex items-center">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        }
                      }}
                      placeholder="+ Add tags"
                      aria-label="Add tags"
                      className={`w-28 px-2 py-0.5 text-xs bg-transparent focus:outline-none placeholder:text-zinc-400 font-mono ${
                        isDark ? 'text-white' : 'text-zinc-900'
                      }`}
                    />
                  </div>

                  <details className="capture-tag-suggestions">
                    <summary>Suggestions</summary>
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                    {SUGGESTED_TAGS.map((stag) => (
                      <button
                        key={stag}
                        type="button"
                        onClick={() => handleAddTag(stag)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono border transition-colors cursor-pointer ${
                          tags.includes(stag)
                            ? (isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 opacity-40' : 'bg-zinc-200 text-zinc-500 border-zinc-300 opacity-40')
                            : (isDark ? 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700' : 'border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300')
                        }`}
                      >
                        #{stag}
                      </button>
                    ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>

            {/* Right Pane: 1:1 Live Simulation Card */}
            <div id="capture-live-preview" className={`capture-preview w-full md:w-[320px] p-6 border-t md:border-t-0 md:border-l flex flex-col shrink-0 min-w-0 ${
              isDark 
                ? 'bg-[#0B0B0D] border-white/[0.08]' 
                : 'bg-[#F4F4F6] border-zinc-200/90'
            } ${type === 'link' || mobileTab === 'editor' ? 'hidden' : 'flex'}`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[11px] font-mono font-semibold uppercase tracking-wider ${
                    isDark ? 'text-zinc-400' : 'text-zinc-700'
                  }`}>
                    Preview
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                    isDark 
                      ? 'bg-[#18181C] text-zinc-300 border-white/[0.08]' 
                      : 'bg-white text-zinc-800 border-zinc-300 shadow-2xs font-medium'
                  }`}>
                    On your canvas
                  </span>
                </div>

                {/* Live Card Shell */}
                <div className={`rounded-3xl p-5 border transition-all ${
                  isDark
                    ? 'bg-[#161619] border-white/[0.09] text-[#F4F4F5] shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
                    : 'bg-white border-zinc-200/90 text-zinc-950 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.02]'
                }`}>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
                      }`}>
                        {type === 'x_post' && <XIcon className="w-3 h-3 shrink-0" />}
                        {type === 'reddit_post' && <RedditIcon className="w-3 h-3 text-zinc-400" />}
                        {type === 'instagram_post' && <InstagramIcon className="w-3 h-3 text-zinc-400" />}
                        {type === 'secret' && <KeyRound className="w-3 h-3 text-zinc-400" />}
                        {type === 'code' && <Code2 className="w-3 h-3 text-zinc-400" />}
                        {type === 'markdown' && <BookOpen className="w-3 h-3 text-zinc-400" />}
                        {type === 'image' && <ImageIcon className="w-3 h-3 text-zinc-400" />}
                        {type === 'link' && <Link2 className="w-3 h-3 text-zinc-400" />}
                        {type === 'note' && <FileText className="w-3 h-3 text-zinc-400" />}
                        <span className="capitalize">{type.replace('_post', '')}</span>
                      </span>

                      {currentFolder && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          isDark ? 'bg-zinc-850 text-zinc-300 border-zinc-750' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}>
                          <span>{currentFolder.name}</span>
                        </span>
                      )}

                      {isPinned && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'
                        }`}>
                          <Pin className="w-2.5 h-2.5 fill-current" />
                          <span>Pinned</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-zinc-400 shrink-0 font-mono">
                      Just now
                    </span>
                  </div>

                  {/* Card Title */}
                  <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-2">
                    {title || previewData?.title || (type === 'secret' ? 'Secret Key' : type === 'code' ? 'Code Snippet' : 'Untitled Item')}
                  </h3>

                  {/* Dynamic Body Preview */}
                  {type === 'x_post' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        {previewData?.authorAvatar ? (
                          <img
                            src={previewData.authorAvatar}
                            alt={previewData.author || 'Author'}
                            className="w-8 h-8 rounded-full object-cover bg-zinc-800 border border-zinc-700/50 shrink-0"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-white shrink-0">
                            <XIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate leading-tight">
                            {previewData?.author || (title && title !== 'Untitled' ? title : (content.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/)?.[1] || 'Creator'))}
                          </p>
                          <p className="text-[11px] text-zinc-400 font-mono leading-tight">
                            {previewData?.authorHandle || (content.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/)?.[1] ? `@${content.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/)![1]}` : '@author')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-200 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                        {secondaryNote || (isFetchingPreview ? 'Fetching live tweet...' : 'Tweet content will appear here...')}
                      </p>
                      {previewData?.imageUrl && (
                        <img
                          src={previewData.imageUrl}
                          alt="Post media"
                          className="w-full h-32 rounded-xl object-cover border border-zinc-800/40"
                        />
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-0.5 font-mono">
                        <span>{previewData?.likes ?? '—'} likes</span>
                        <span>{previewData?.reposts ?? '—'} reposts</span>
                      </div>
                    </div>
                  ) : type === 'instagram_post' ? (
                    <div className="space-y-2">
                      <div className="w-full h-36 rounded-xl overflow-hidden bg-zinc-800 flex items-center justify-center">
                        {previewData?.imageUrl || (content.startsWith('http') && !content.includes('instagram.com')) ? (
                          <img
                            src={previewData?.imageUrl || content}
                            alt="Instagram"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <InstagramIcon className="w-8 h-8 text-zinc-500" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2">
                        {secondaryNote || title || (previewData?.authorHandle ? `Post by ${previewData.authorHandle}` : '@instagram post')}
                      </p>
                    </div>
                  ) : type === 'reddit_post' ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-mono text-zinc-400">
                        {previewData?.publisher || (content.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/)?.[1] ? `r/${content.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/)![1]}` : 'r/community')}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3">
                        {secondaryNote || (isFetchingPreview ? 'Fetching Reddit post...' : 'Reddit thread body...')}
                      </p>
                    </div>
                  ) : type === 'secret' ? (
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}>
                      <span className="font-mono text-xs tracking-wider text-zinc-400">
                        {showSecret && content ? content : '••••••••••••••••'}
                      </span>
                      <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  ) : type === 'code' ? (
                    <div className={`p-3 rounded-xl font-mono text-[11px] border overflow-hidden ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
                    }`}>
                      <div className="text-[10px] text-zinc-500 mb-1 flex items-center justify-between">
                        <span>{codeLanguage}</span>
                        <span>{content ? content.split('\n').length : 1} lines</span>
                      </div>
                      <pre className="line-clamp-4 leading-relaxed">
                        {content || '// Code snippet will render here...'}
                      </pre>
                    </div>
                  ) : type === 'image' ? (
                    <div className="w-full h-36 rounded-xl overflow-hidden bg-zinc-800 flex items-center justify-center">
                      {content ? (
                        <img src={content} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-600" />
                      )}
                    </div>
                  ) : type === 'link' ? (
                    <div className="space-y-2">
                      {previewData?.imageUrl ? (
                        <div className="overflow-hidden rounded-xl border border-zinc-800/80">
                          <img
                            src={previewData.imageUrl}
                            alt="Cover"
                            className="w-full h-28 object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : null}
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {secondaryNote || previewData?.description || 'Save now, or add your own notes.'}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                        {previewData?.favicon && (
                          <img src={previewData.favicon} alt="" className="w-3 h-3 rounded-xs" />
                        )}
                        <span>{previewData?.domain || 'web link'}</span>
                      </span>
                    </div>
                  ) : isChecklistMode ? (
                    <div className="space-y-1.5">
                      {checklistItems.slice(0, 4).map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs">
                          {c.completed ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          )}
                          <span className={`truncate ${c.completed ? 'line-through text-zinc-400' : ''}`}>
                            {c.text}
                          </span>
                        </div>
                      ))}
                      {checklistItems.length > 4 && (
                        <span className="text-[10px] text-zinc-400">+{checklistItems.length - 4} more items</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-4 whitespace-pre-wrap leading-relaxed">
                      {content || 'Your note text will appear here...'}
                    </p>
                  )}

                  {/* Card Tags Preview */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/60">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-mono text-zinc-400"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-zinc-500">Your item will look like this in the collection.</p>
            </div>
          </div>

          {formError && <p role="alert" className="capture-error py-2 text-sm text-rose-300">{formError}</p>}
          {/* Bottom Action Footer Bar */}
          <div className={`capture-footer px-6 py-4 flex items-center justify-between gap-3 shrink-0 transition-colors ${
            isDark ? 'border-white/[0.08] bg-[#0E0E10]' : 'border-zinc-200/80 bg-zinc-50/70'
          }`}>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 font-mono text-[10px] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Ctrl / ⌘
              </kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 font-mono text-[10px] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Enter
              </kbd>
              <span>to save</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!content.trim() && !title.trim() && checklistItems.length === 0}
                className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer transition-all flex items-center gap-2 active:scale-95 ${
                  !content.trim() && !title.trim() && checklistItems.length === 0
                    ? 'opacity-40 cursor-not-allowed bg-zinc-300 dark:bg-zinc-800 text-zinc-500'
                    : isDark
                    ? 'bg-white text-zinc-950 hover:bg-zinc-200'
                    : 'bg-zinc-950 text-white hover:bg-black shadow-[0_2px_12px_rgba(0,0,0,0.18)]'
                }`}
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Save to Anything</span>
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
