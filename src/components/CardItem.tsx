import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Pin, 
  Trash2, 
  Copy, 
  Check, 
  Heart, 
  Repeat2, 
  MessageSquare, 
  ArrowUpRight, 
  CheckSquare, 
  Square, 
  Code2, 
  Maximize2,
  BookOpen,
  Sparkles,
  Folder as FolderIcon,
  KeyRound
} from 'lucide-react';
import { SavedItem, NoteItem, CodeItem, MarkdownItem } from '../types';
import { sound } from '../utils/sound';
import { SecretReveal } from './SecretReveal';
import { MarkdownRenderer } from './MarkdownRenderer';
import { InstagramIcon, RedditIcon, XIcon } from './Icons';
import confetti from 'canvas-confetti';

interface CardItemProps {
  item: SavedItem;
  folderName?: string;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  onOpenImage?: (imageUrl: string, title: string) => void;
  onOpenDetail?: (item: SavedItem) => void;
  isDark?: boolean;
}

export const CardItem: React.FC<CardItemProps> = ({
  item,
  folderName,
  onTogglePin,
  onDelete,
  onUpdateItem,
  onOpenImage,
  onOpenDetail,
  isDark = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLinkOrContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = '';
    if ('postUrl' in item && item.postUrl) textToCopy = item.postUrl;
    else if ('url' in item && item.url) textToCopy = item.url;
    else if ('content' in item && item.content) textToCopy = item.content;
    else if ('code' in item && item.code) textToCopy = item.code;
    else if ('secretValue' in item && item.secretValue) textToCopy = item.secretValue;
    else textToCopy = item.title;

    navigator.clipboard.writeText(textToCopy);
    sound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleToggleChecklist = (e: React.MouseEvent, checkId: string) => {
    e.stopPropagation();
    if (item.type !== 'note' || !item.checklist) return;
    const updatedChecklist = item.checklist.map((c) => {
      if (c.id === checkId) {
        const nextState = !c.completed;
        if (nextState) {
          sound.pop();
          const allOthersDone = item.checklist!.filter(x => x.id !== checkId).every(x => x.completed);
          if (allOthersDone) {
            confetti({ particleCount: 30, spread: 45, origin: { y: 0.7 } });
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
    month: 'short',
    day: 'numeric',
  }).format(new Date(item.createdAt));

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16, ease: 'easeOut' } }}
      transition={{
        layout: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.2, ease: 'easeOut' },
      }}
      className="w-full"
    >
      <motion.article
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        onClick={() => onOpenDetail?.(item)}
        className={`group relative flex flex-col justify-between rounded-3xl p-5 border cursor-pointer select-none transition-all ${
          isDark
            ? 'bg-[#141417] border-white/[0.08] hover:border-white/[0.16] shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] text-[#F4F4F5]'
            : 'bg-white border-zinc-200/90 hover:border-zinc-300 hover:shadow-lg'
        }`}
      >
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Type Badge */}
          <div className="flex items-center gap-2">
            {item.type === 'x_post' && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                <XIcon className="w-3 h-3 shrink-0" />
                <span>Post</span>
              </span>
            )}
            {item.type === 'reddit_post' && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                <RedditIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Reddit</span>
              </span>
            )}
            {item.type === 'instagram_post' && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                <InstagramIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Instagram</span>
              </span>
            )}
            {item.type === 'note' && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                Note
              </span>
            )}
            {item.type === 'secret' && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'bg-zinc-900 text-white'
              }`}>
                <KeyRound className="w-3.5 h-3.5" />
                <span>Secret</span>
              </span>
            )}
            {item.type === 'image' && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                Image
              </span>
            )}
            {item.type === 'link' && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                Link
              </span>
            )}
            {item.type === 'code' && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                <Code2 className="w-3.5 h-3.5" />
                {(item as CodeItem).language || 'Code'}
              </span>
            )}
            {item.type === 'markdown' && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                (item as MarkdownItem).isSkill
                  ? (isDark ? 'bg-zinc-800 border border-zinc-700 text-zinc-200' : 'bg-zinc-100 border border-zinc-200 text-zinc-800')
                  : (isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800')
              }`}>
                {(item as MarkdownItem).isSkill ? (
                  <>
                    <Sparkles className="w-3 h-3 text-zinc-400" />
                    <span>Skill</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3 h-3 text-zinc-400" />
                    <span>Markdown</span>
                  </>
                )}
              </span>
            )}

            {folderName && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                isDark 
                  ? 'bg-zinc-850 text-zinc-300 border-zinc-750' 
                  : 'bg-zinc-100 text-zinc-700 border-zinc-200'
              }`}>
                <FolderIcon className="w-3 h-3 text-zinc-400" />
                <span>{folderName}</span>
              </span>
            )}

            {item.isPinned && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'
              }`}>
                <Pin className="w-2.5 h-2.5 fill-current" />
                <span>Pinned</span>
              </span>
            )}

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {formattedDate}
            </span>
          </div>

        {/* Action Buttons: Expand to Whole View, Pin, Copy & Delete (Always visible, no hover reveal) */}
        <div className="flex items-center gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Expand to Whole View */}
          <button
            onClick={() => onOpenDetail?.(item)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Open in Whole View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Pin Button */}
          <button
            onClick={() => {
              sound.pin();
              onTogglePin(item.id);
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              item.isPinned
                ? (isDark ? 'bg-white text-zinc-950 shadow-xs' : 'bg-zinc-900 text-white shadow-xs')
                : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={item.isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} />
          </button>

          {/* Quick Copy */}
          <button
            onClick={handleCopyLinkOrContent}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Copy content or link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Delete Button */}
          <button
            onClick={() => {
              sound.delete();
              onDelete(item.id);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            title="Delete item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Card Content (Slightly Bigger, More Readable Text!) */}
      <div className="space-y-3 flex-1">
        
        {/* Title */}
        {item.title && item.type !== 'x_post' && (
          <h3 className={`font-semibold tracking-tight ${
            isDark ? 'text-zinc-100' : 'text-zinc-900'
          } ${
            item.type === 'note' && (item as NoteItem).typography === 'serif'
              ? 'font-serif text-lg sm:text-xl font-medium'
              : 'text-base'
          }`}>
            {item.title}
          </h3>
        )}

        {/* 1. X / Twitter Card */}
        {item.type === 'x_post' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {item.authorAvatar ? (
                  <img
                    src={item.authorAvatar}
                    alt={item.authorName}
                    className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                  />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                  }`}>
                    {(item.authorName || 'User').charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      {item.authorName || 'User'}
                    </span>
                    {item.isVerified && (
                      <span className="text-[10px] text-blue-500 font-bold" title="Verified">
                        ●
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-zinc-400 block -mt-0.5">
                    @{item.authorHandle ? item.authorHandle.replace(/^@/, '') : 'user'}
                  </span>
                </div>
              </div>

              {item.postUrl && (
                <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              )}
            </div>

            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
              isDark ? 'text-zinc-300' : 'text-zinc-800'
            }`}>
              {item.content}
            </p>

            {item.imageUrl && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenImage?.(item.imageUrl!, item.title || 'Post Media');
                }}
                className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 cursor-zoom-in"
              >
                <img
                  src={item.imageUrl}
                  alt="Post visual"
                  className="w-full max-h-64 object-cover hover:scale-101 transition-transform"
                  loading="lazy"
                />
              </div>
            )}

            <div className="flex items-center gap-4 pt-1.5 text-xs font-mono text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800/60">
              {item.likes !== undefined && (
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" /> {item.likes.toLocaleString()}
                </span>
              )}
              {item.reposts !== undefined && (
                <span className="flex items-center gap-1">
                  <Repeat2 className="w-3.5 h-3.5" /> {item.reposts.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2. Reddit Card */}
        {item.type === 'reddit_post' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>{item.subreddit}</span>
              <span>{item.author}</span>
            </div>

            <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {item.content}
            </p>

            {item.imageUrl && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenImage?.(item.imageUrl!, item.title);
                }}
                className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 cursor-zoom-in"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full max-h-56 object-cover"
                  loading="lazy"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1.5 text-xs font-mono text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800/60">
              <div className="flex items-center gap-3">
                {item.upvotes !== undefined && <span>▲ {item.upvotes.toLocaleString()}</span>}
                {item.commentsCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {item.commentsCount}
                  </span>
                )}
              </div>
              <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white flex items-center gap-0.5">
                read
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        )}

        {/* 3. Instagram Card */}
        {item.type === 'instagram_post' && (
          <div className="space-y-2.5">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onOpenImage?.(item.imageUrl, item.caption || item.handle);
              }}
              className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-zoom-in relative group/img"
            >
              <img
                src={item.imageUrl}
                alt={item.caption || item.handle}
                className="w-full aspect-square object-cover"
                loading="lazy"
              />
              <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/90 backdrop-blur-xs transition-colors hover:bg-black/75">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>@{item.handle}</span>
              {item.likes !== undefined && (
                <span className="flex items-center gap-1 text-zinc-400">
                  <Heart className="w-3 h-3 text-zinc-400" />
                  <span>{item.likes.toLocaleString()}</span>
                </span>
              )}
            </div>

            {item.caption && (
              <p className={`text-xs line-clamp-3 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {item.caption}
              </p>
            )}
          </div>
        )}

        {/* 4. Note Card */}
        {item.type === 'note' && (
          <div className="space-y-3">
            <p className={`leading-relaxed text-sm whitespace-pre-wrap ${
              isDark ? 'text-zinc-300' : 'text-zinc-700'
            } ${
              item.typography === 'serif' ? 'font-serif text-base' : 
              item.typography === 'mono' ? 'font-mono text-xs' : ''
            }`}>
              {item.content}
            </p>

            {item.checklist && item.checklist.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
                {item.checklist.map((check) => (
                  <button
                    key={check.id}
                    type="button"
                    onClick={(e) => handleToggleChecklist(e, check.id)}
                    className={`w-full flex items-start gap-2.5 text-left text-xs sm:text-sm py-1 rounded-lg px-1 -mx-1 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                    }`}
                  >
                    {check.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                    )}
                    <span className={`transition-all leading-snug ${
                      check.completed ? 'line-through text-zinc-400 dark:text-zinc-600' : (isDark ? 'text-zinc-200' : 'text-zinc-800')
                    }`}>
                      {check.text}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Secret / Password Card */}
        {item.type === 'secret' && (
          <div onClick={(e) => e.stopPropagation()}>
            <SecretReveal item={item} />
          </div>
        )}

        {/* 6. Image Card */}
        {item.type === 'image' && (
          <div className="space-y-2">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onOpenImage?.(item.imageUrl, item.title);
              }}
              className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-zoom-in relative group/img"
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full max-h-72 object-cover hover:scale-101 transition-transform"
                loading="lazy"
              />
              <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/90 backdrop-blur-xs transition-colors hover:bg-black/75">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {item.caption && (
              <p className={`text-xs italic leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {item.caption}
              </p>
            )}
          </div>
        )}

        {/* 7. Link Card */}
        {item.type === 'link' && (() => {
          const coverImage = item.previewImage || (item.url ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(item.url)}?w=800` : undefined);
          return (
            <div className="space-y-2.5">
              {coverImage && (
                <div 
                  onClick={(e) => {
                    if (coverImage && onOpenImage) {
                      e.stopPropagation();
                      onOpenImage(coverImage, item.title);
                    }
                  }}
                  className={`overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 ${
                    onOpenImage ? 'cursor-zoom-in' : ''
                  }`}
                >
                  <img
                    src={coverImage}
                    alt={item.title}
                    className="w-full max-h-48 object-cover hover:scale-101 transition-transform"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.src.includes('s0.wp.com') && item.url) {
                        img.src = `https://s0.wp.com/mshots/v1/${encodeURIComponent(item.url)}?w=800`;
                      } else {
                        const parent = img.parentElement;
                        if (parent) parent.style.display = 'none';
                      }
                    }}
                  />
                </div>
              )}

            {item.description && (
              <p className={`text-xs sm:text-sm line-clamp-3 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {item.description}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center gap-1.5 text-xs font-mono transition-colors group/link ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                {item.favicon && (
                  <img src={item.favicon} alt="" className="w-3.5 h-3.5 rounded-xs" />
                )}
                <span className="underline decoration-zinc-300 dark:decoration-zinc-700 underline-offset-4 group-hover/link:decoration-current">
                  {item.domain || item.url}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        );
      })()}

        {/* 8. Code Card */}
        {item.type === 'code' && (
          <div className="space-y-2">
            <div className="relative rounded-2xl bg-zinc-950 p-3.5 text-white font-mono text-xs overflow-x-auto border border-zinc-800 shadow-inner">
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

        {/* 9. Markdown / Skill Card */}
        {item.type === 'markdown' && (
          <div className="space-y-2 relative max-h-48 overflow-hidden rounded-xl">
            <MarkdownRenderer content={((item as MarkdownItem).content || '').slice(0, 450)} isDark={isDark} />
            <div className={`absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t ${
              isDark ? 'from-[#18181B] to-transparent' : 'from-white to-transparent'
            }`} />
          </div>
        )}

      </div>
      </motion.article>
    </motion.div>
  );
};
