import { getItemTitle } from '../utils/itemTitle';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Pin, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Edit3, 
  Eye, 
  Folder as FolderIcon,
  Sparkles,
  Share2,
  Code2
} from 'lucide-react';
import { SavedItem, Folder, MarkdownItem, NoteItem, CodeItem } from '../types';
import { sound } from '../utils/sound';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SecretReveal } from './SecretReveal';
import { XIcon } from './Icons';
import confetti from 'canvas-confetti';

interface WholeViewModalProps {
  item: SavedItem | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  folders: Folder[];
  isDark?: boolean;
}

export const WholeViewModal: React.FC<WholeViewModalProps> = ({
  item,
  isOpen,
  onClose,
  onTogglePin,
  onDelete,
  onUpdateItem,
  folders,
  isDark = true,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (item) {
      setEditTitle(item.title || '');
      if ('content' in item && item.content) {
        setEditContent(item.content);
      } else if ('code' in item && item.code) {
        setEditContent(item.code);
      } else {
        setEditContent('');
      }
      setIsEditing(false);
    }
  }, [item]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const currentFolder = folders.find((f) => f.id === item.folderId);

  const handleCopy = () => {
    let textToCopy = '';
    if ('content' in item && item.content) textToCopy = item.content;
    else if ('code' in item && item.code) textToCopy = item.code;
    else if ('postUrl' in item && item.postUrl) textToCopy = item.postUrl;
    else if ('url' in item && item.url) textToCopy = item.url;
    else if ('secretValue' in item && item.secretValue) textToCopy = item.secretValue;
    else textToCopy = item.title;

    navigator.clipboard.writeText(textToCopy);
    sound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdits = () => {
    if ('content' in item) {
      onUpdateItem({
        ...item,
        title: editTitle,
        content: editContent,
      } as SavedItem);
    } else if ('code' in item) {
      onUpdateItem({
        ...item,
        title: editTitle,
        code: editContent,
      } as SavedItem);
    }
    sound.save();
    setIsEditing(false);
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(item.createdAt));

  return (
    <AnimatePresence>
      <motion.dialog
        ref={dialogRef}
        aria-label={item.title}
        onCancel={event => { event.preventDefault(); onClose(); }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={`memory-reader fixed inset-0 z-50 overflow-y-auto flex flex-col transition-colors ${
          isDark ? 'bg-[#121214] text-[#F4F4F5]' : 'bg-white text-[#111111]'
        }`}
      >
        {/* Whole View Top Bar */}
        <header className={`sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b backdrop-blur-xl ${
          isDark 
            ? 'bg-[#121214]/90 border-zinc-800/80' 
            : 'bg-white/90 border-zinc-200/80'
        }`}>
          {/* Back Button & Item Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                sound.click();
                onClose();
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isDark 
                  ? 'bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700' 
                  : 'bg-zinc-100 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {/* Folder badge */}
            {currentFolder && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
              }`}>
                <FolderIcon className="w-3 h-3 text-indigo-400" />
                <span>{currentFolder.name}</span>
              </span>
            )}

            {/* Type badge */}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
              isDark ? 'bg-zinc-850 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {item.type === 'markdown' ? 'Markdown Document' : item.type.replace('_', ' ')}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {('content' in item || 'code' in item) && (
              <button
                onClick={() => {
                  sound.click();
                  if (isEditing) {
                    handleSaveEdits();
                  } else {
                    setIsEditing(true);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isEditing 
                    ? (isDark ? 'bg-white text-zinc-950 font-semibold' : 'bg-zinc-900 text-white font-medium')
                    : (isDark ? 'bg-zinc-800/80 text-zinc-300 hover:text-white' : 'bg-zinc-100 text-zinc-700 hover:text-zinc-950')
                }`}
              >
                {isEditing ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </>
                )}
              </button>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isDark ? 'bg-zinc-800/80 text-zinc-300 hover:text-white' : 'bg-zinc-100 text-zinc-700 hover:text-zinc-950'
              }`}
              title="Copy content"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Pin */}
            <button
              onClick={() => {
                sound.pin();
                onTogglePin(item.id);
              }}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                item.isPinned
                  ? (isDark ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-white')
                  : (isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100')
              }`}
              title={item.isPinned ? 'Unpin' : 'Pin to top'}
            >
              <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} />
            </button>

            {/* Delete */}
            <button
              onClick={() => {
                sound.delete();
                onDelete(item.id);
                onClose();
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              title="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Main Canvas Viewport */}
        <main className={`flex-1 w-full max-w-4xl mx-auto px-6 sm:px-12 py-10 space-y-6 ${item.type === 'link' ? 'reader-link-main' : ''}`}>
          {/* Header section: Title & Date */}
          <div className="space-y-3 pb-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title..."
                className={`w-full text-2xl sm:text-4xl font-bold tracking-tight bg-transparent focus:outline-none ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              />
            ) : (
              <h1 className={`text-2xl sm:text-4xl font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}>
                {getItemTitle(item)}
              </h1>
            )}

            {item.type === 'link' && <a className="reader-link-url" href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>{item.favicon && <img src={item.favicon} alt="" />}<span>{item.url}</span><ExternalLink /></a>}

            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <span>Saved on {formattedDate}</span>
              {item.tags && item.tags.length > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    {item.tags.map((t) => (
                      <span key={t} className="text-zinc-500 dark:text-zinc-400">
                        #{t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Body Content based on Item Type */}
          {item.type === 'markdown' ? (
            <div>
              {isEditing ? (
                <textarea
                  rows={20}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Paste or write markdown here..."
                  className={`w-full p-6 rounded-2xl font-mono text-sm leading-relaxed focus:outline-none border resize-none transition-all ${
                    isDark 
                      ? 'bg-zinc-900/90 border-zinc-800 text-white focus:border-zinc-600' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-400'
                  }`}
                />
              ) : (
                <div className="py-2">
                  <MarkdownRenderer content={(item as MarkdownItem).content} isDark={isDark} />
                </div>
              )}
            </div>
          ) : item.type === 'note' ? (
            <div>
              {isEditing ? (
                <textarea
                  rows={15}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={`w-full p-6 rounded-2xl text-base leading-relaxed focus:outline-none border resize-none transition-all ${
                    isDark 
                      ? 'bg-zinc-900/90 border-zinc-800 text-white focus:border-zinc-600' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-400'
                  }`}
                />
              ) : (
                <div className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap py-2">
                  {(item as NoteItem).content}
                </div>
              )}
            </div>
          ) : item.type === 'x_post' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                {item.authorAvatar && (
                  <img src={item.authorAvatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                )}
                <div>
                  <h4 className="font-semibold text-base">{item.authorName}</h4>
                  <p className="text-xs text-zinc-400">@{item.authorHandle}</p>
                </div>
              </div>

              <p className="text-lg leading-relaxed whitespace-pre-wrap">{item.content}</p>

              {item.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                  <img src={item.imageUrl} alt="" className="w-full h-auto object-contain" />
                </div>
              )}

              <a
                href={item.postUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
                <span>View on X</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : item.type === 'link' ? (
            <div className={`reader-link-layout ${item.previewImage ? '' : 'reader-link-text-only'}`}>
              {item.previewImage && <div className="reader-link-image"><img src={item.previewImage} alt={getItemTitle(item)} /></div>}
              <div className="reader-link-summary">
                <span className="mind-eyebrow">Saved for later</span>
                {item.description && <p>{item.description}</p>}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="mind-save-button"><span>Open website</span><ExternalLink /></a>
              </div>
            </div>
          ) : item.type === 'code' ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-zinc-950 p-6 border border-zinc-800 overflow-x-auto shadow-2xl">
                <pre className="text-zinc-100 font-mono text-sm leading-relaxed">
                  <code>{(item as CodeItem).code}</code>
                </pre>
              </div>
            </div>
          ) : item.type === 'image' ? (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 max-h-[600px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                <img src={item.imageUrl} alt="" className="w-full h-full object-contain" />
              </div>
              {item.caption && (
                <p className="text-base text-zinc-500 dark:text-zinc-400 italic text-center">
                  {item.caption}
                </p>
              )}
            </div>
          ) : item.type === 'secret' ? (
            <div className="space-y-4 max-w-md">
              <SecretReveal item={item as any} />
            </div>
          ) : null}

        </main>
      </motion.dialog>
    </AnimatePresence>
  );
};
