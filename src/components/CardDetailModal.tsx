import { getItemTitle } from '../utils/itemTitle';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Pin, 
  Trash2, 
  Copy, 
  Check, 
  ArrowUpRight, 
  Heart, 
  Repeat2, 
  MessageSquare, 
  CheckSquare, 
  Square,
  Eye,
  EyeOff,
  Code2,
  Calendar,
  Sparkles,
  ExternalLink,
  Maximize2,
  RefreshCw,
  Folder as FolderIcon
} from 'lucide-react';
import { SavedItem, NoteItem, CodeItem, MarkdownItem, Folder } from '../types';
import { fetchLinkPreview, applyLinkPreview } from '../utils/fetchPreview';
import { sound } from '../utils/sound';
import { SecretReveal } from './SecretReveal';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FolderDropdown } from './FolderDropdown';
import { XIcon } from './Icons';
import confetti from 'canvas-confetti';

interface CardDetailModalProps {
  item: SavedItem | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  onOpenImage?: (imageUrl: string, title: string) => void;
  onOpenWholeView?: (item: SavedItem) => void;
  folders?: Folder[];
  onCreateFolder?: (name: string) => Folder;
  isDark?: boolean;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onTogglePin,
  onDelete,
  onUpdateItem,
  onOpenImage,
  onOpenWholeView,
  folders = [],
  onCreateFolder,
  isDark = true,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<{ id: string; message: string } | null>(null);
  const latestItem = useRef(item);
  latestItem.current = item;

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

  const handleCopy = () => {
    let textToCopy = '';
    if ('postUrl' in item && item.postUrl) textToCopy = item.postUrl;
    else if ('url' in item && item.url) textToCopy = item.url;
    else if ('secretValue' in item && item.secretValue) textToCopy = item.secretValue;
    else if ('content' in item && item.content) textToCopy = item.content;
    else if ('code' in item && item.code) textToCopy = item.code;
    else textToCopy = item.title;

    navigator.clipboard.writeText(textToCopy);
    sound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleToggleChecklist = (checkId: string) => {
    if (item.type !== 'note' || !item.checklist) return;
    const updatedChecklist = item.checklist.map((c) => {
      if (c.id === checkId) {
        const nextState = !c.completed;
        if (nextState) {
          sound.pop();
          const allOthersDone = item.checklist!.filter(x => x.id !== checkId).every(x => x.completed);
          if (allOthersDone) {
            confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
          }
        } else {
          sound.click();
        }
        return { ...c, completed: nextState };
      }
      return c;
    });

    onUpdateItem({
      ...item,
      checklist: updatedChecklist,
    });
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(item.createdAt));

  return (
    <AnimatePresence>
      <dialog ref={dialogRef} aria-label={item.title} onCancel={event => { event.preventDefault(); onClose(); }} className="memory-dialog fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => {
            sound.click();
            onClose();
          }}
          className={`fixed inset-0 ${isDark ? 'bg-black/70' : 'bg-black/25'} backdrop-blur-sm`}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`memory-detail relative w-full max-w-3xl rounded-3xl border shadow-2xl p-6 sm:p-8 z-10 my-8 overflow-hidden transition-colors ${
            isDark 
              ? 'bg-[#18181B] border-zinc-800 text-[#F4F4F5]' 
              : 'bg-white border-zinc-200 text-[#111111]'
          }`}
        >
          {/* Top Bar: Platform pill, Folder picker, date & Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-zinc-200/60 dark:border-zinc-800/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                {item.type === 'markdown' ? 'Markdown Document' : item.type.replace('_', ' ')}
              </span>

              {/* Folder Dropdown inside Detail View */}
              <FolderDropdown
                folders={folders}
                selectedFolderId={item.folderId}
                onSelectFolder={(newFolderId) => {
                  onUpdateItem({
                    ...item,
                    folderId: newFolderId || undefined,
                  });
                }}
                onCreateFolder={onCreateFolder}
                isDark={isDark}
              />

              <span className="text-xs text-zinc-400">
                {formattedDate}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {(item.type === 'link' || item.type === 'x_post') && <button type="button" disabled={isRefreshing} aria-label="Refresh preview" title="Refresh preview" className="p-2 rounded-xl text-zinc-500 cursor-pointer disabled:opacity-40" onClick={async () => {
                const id = item.id;
                setIsRefreshing(true);
                setPreviewStatus(null);
                try {
                  const data = await fetchLinkPreview(item.type === 'link' ? item.url : item.postUrl, true);
                  if (latestItem.current?.id !== id) return;
                  if (data.error) { setPreviewStatus({ id, message: data.error }); return; }
                  onUpdateItem(applyLinkPreview(latestItem.current, data));
                  setPreviewStatus({ id, message: 'Preview updated.' });
                } catch { setPreviewStatus({ id, message: 'Could not update this preview.' }); }
                finally { setIsRefreshing(false); }
              }}><RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /></button>}
              {/* Whole View Button */}
              {onOpenWholeView && (
                <button
                  onClick={() => {
                    sound.click();
                    onClose();
                    onOpenWholeView(item);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDark ? 'bg-zinc-800 text-zinc-300 hover:text-white' : 'bg-zinc-100 text-zinc-700 hover:text-zinc-950'
                  }`}
                  title="Open in Whole View"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Whole View</span>
                </button>
              )}
              {/* Pin */}
              <button
                onClick={() => {
                  sound.pin();
                  onTogglePin(item.id);
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  item.isPinned
                    ? (isDark ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-white')
                    : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
                title={item.isPinned ? 'Unpin' : 'Pin to top'}
              >
                <Pin className={`w-4 h-4 ${item.isPinned ? 'fill-current' : ''}`} />
              </button>

              {/* Copy */}
              <button
                onClick={handleCopy}
                className={`p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer`}
                title="Copy link or content"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  sound.delete();
                  onDelete(item.id);
                  onClose();
                }}
                className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close */}
              <button
                onClick={() => {
                  sound.click();
                  onClose();
                }}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {previewStatus?.id === item.id && <p role="status" className="mb-4 text-xs text-zinc-500">{previewStatus.message}</p>}

          {/* Main Card Detail Content (Larger, Readable Fonts!) */}
          <div className="memory-detail-content space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            
            {/* Title */}
            {item.title && (
              <h2 className={`text-xl sm:text-2xl font-semibold tracking-tight ${
                item.type === 'note' && (item as NoteItem).typography === 'serif'
                  ? 'font-serif text-2xl sm:text-3xl font-medium'
                  : ''
              }`}>
                {getItemTitle(item)}
              </h2>
            )}

            {/* 1. X Post Full View */}
            {item.type === 'x_post' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.authorAvatar ? (
                      <img
                        src={item.authorAvatar}
                        alt={item.authorName}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-800'
                      }`}>
                        {item.authorName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm sm:text-base">
                          {item.authorName}
                        </span>
                        {item.isVerified && (
                          <span className="text-xs text-blue-500 font-bold">●</span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-zinc-400">
                        @{item.authorHandle.replace(/^@/, '')}
                      </span>
                    </div>
                  </div>

                  {item.postUrl && (
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-mono hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                      <span>Open on X</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Tweet text in larger font */}
                <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {item.content}
                </p>

                {item.imageUrl && (
                  <div 
                    onClick={() => onOpenImage?.(item.imageUrl!, item.title || 'Post Media')}
                    className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 cursor-zoom-in"
                  >
                    <img
                      src={item.imageUrl}
                      alt="Post visual"
                      className="w-full max-h-96 object-cover hover:scale-101 transition-transform"
                    />
                  </div>
                )}

                <div className="flex items-center gap-6 pt-2 text-xs font-mono text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800/80">
                  {item.likes !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4" /> {item.likes.toLocaleString()} Likes
                    </span>
                  )}
                  {item.reposts !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <Repeat2 className="w-4 h-4" /> {item.reposts.toLocaleString()} Reposts
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 2. Reddit Post Full View */}
            {item.type === 'reddit_post' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span className="text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
                    {item.subreddit}
                  </span>
                  <span>Posted by {item.author}</span>
                </div>

                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {item.content}
                </p>

                {item.imageUrl && (
                  <div 
                    onClick={() => onOpenImage?.(item.imageUrl!, item.title)}
                    className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 cursor-zoom-in"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full max-h-96 object-cover"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 text-xs font-mono text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-4">
                    {item.upvotes !== undefined && <span>▲ {item.upvotes.toLocaleString()} upvotes</span>}
                    {item.commentsCount !== undefined && (
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{item.commentsCount} comments</span>
                      </span>
                    )}
                  </div>
                  {item.postUrl && (
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 hover:underline"
                    >
                      <span>Reddit Thread</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* 3. Instagram Post Full View */}
            {item.type === 'instagram_post' && (
              <div className="space-y-4">
                <div 
                  onClick={() => onOpenImage?.(item.imageUrl, item.caption || item.handle)}
                  className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-zoom-in"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.caption || item.handle}
                    className="w-full max-h-[460px] object-cover"
                  />
                </div>

                <div className="flex items-center justify-between text-sm font-mono">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    @{item.handle}
                  </span>
                  {item.likes !== undefined && (
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <Heart className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{item.likes.toLocaleString()} likes</span>
                    </span>
                  )}
                </div>

                {item.caption && (
                  <p className="text-sm sm:text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {item.caption}
                  </p>
                )}

                {item.postUrl && (
                  <a
                    href={item.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-zinc-500 hover:text-black dark:hover:text-white"
                  >
                    <span>View original on Instagram</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* 4. Note Full View */}
            {item.type === 'note' && (
              <div className="space-y-4">
                <p className={`text-base sm:text-lg leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 ${
                  item.typography === 'serif' ? 'font-serif text-xl sm:text-2xl leading-relaxed' :
                  item.typography === 'mono' ? 'font-mono text-sm leading-relaxed' : ''
                }`}>
                  {item.content}
                </p>

                {item.checklist && item.checklist.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-2">
                      // tasks ({item.checklist.filter(c => c.completed).length} / {item.checklist.length})
                    </span>
                    {item.checklist.map((check) => (
                      <button
                        key={check.id}
                        type="button"
                        onClick={() => handleToggleChecklist(check.id)}
                        className={`w-full flex items-start gap-3 text-left text-sm py-2 px-3 rounded-xl transition-colors cursor-pointer ${
                          isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'
                        }`}
                      >
                        {check.completed ? (
                          <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                        )}
                        <span className={`transition-all leading-relaxed ${
                          check.completed ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'
                        }`}>
                          {check.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. Secret Full View */}
            {item.type === 'secret' && (
              <div className="space-y-4 pt-1">
                <SecretReveal item={item} />
              </div>
            )}

            {/* 6. Image Full View */}
            {item.type === 'image' && (
              <div className="space-y-4">
                <div 
                  onClick={() => onOpenImage?.(item.imageUrl, item.title)}
                  className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-zoom-in"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full max-h-[500px] object-contain bg-zinc-50 dark:bg-zinc-900 rounded-xl"
                  />
                </div>
                {item.caption && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                    {item.caption}
                  </p>
                )}
              </div>
            )}

            {/* 7. Link Full View */}
            {item.type === 'link' && (
              <div className="space-y-4">
                {item.previewImage && (
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <img
                      src={item.previewImage}
                      alt={item.title}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                )}

                {item.description && (
                  <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {item.description}
                  </p>
                )}

                <div className="pt-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all shadow-xs ${
                      isDark ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-black'
                    }`}
                  >
                    {item.favicon && <img src={item.favicon} alt="" className="w-4 h-4 rounded-xs" />}
                    <span>Visit {item.domain || 'Website'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* 8. Code Full View */}
            {item.type === 'code' && (
              <div className="space-y-3">
                <div className="relative rounded-2xl bg-zinc-950 p-4 text-white font-mono text-xs overflow-x-auto border border-zinc-800">
                  <pre className="text-zinc-200 leading-relaxed font-mono whitespace-pre">
                    <code>{item.code}</code>
                  </pre>
                </div>
                {item.description && (
                  <p className="text-xs text-zinc-400 italic">
                    {item.description}
                  </p>
                )}
              </div>
            )}

            {/* 9. Markdown Document */}
            {item.type === 'markdown' && (
              <div className="py-2">
                <MarkdownRenderer content={(item as MarkdownItem).content} isDark={isDark} />
              </div>
            )}

          </div>
        </motion.div>
      </dialog>
    </AnimatePresence>
  );
};
