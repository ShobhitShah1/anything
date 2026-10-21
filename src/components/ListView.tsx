import { getItemTitle } from '../utils/itemTitle';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pin, 
  Trash2, 
  ArrowUpRight, 
  Copy, 
  Check, 
  Key, 
  FileText, 
  Image as ImageIcon, 
  Link2, 
  Code2, 
  BookOpen,
  Folder as FolderIcon
} from 'lucide-react';
import { SavedItem, Folder } from '../types';
import { sound } from '../utils/sound';
import { InstagramIcon, XIcon } from './Icons';

interface ListViewProps {
  items: SavedItem[];
  folders?: Folder[];
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenItem?: (item: SavedItem) => void;
  isDark?: boolean;
}

export const ListView: React.FC<ListViewProps> = ({
  items,
  folders = [],
  onTogglePin,
  onDelete,
  onOpenItem,
  isDark = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, item: SavedItem) => {
    e.stopPropagation();
    let textToCopy = '';
    if ('postUrl' in item && item.postUrl) textToCopy = item.postUrl;
    else if ('url' in item && item.url) textToCopy = item.url;
    else if ('secretValue' in item && item.secretValue) textToCopy = item.secretValue;
    else if ('content' in item && item.content) textToCopy = item.content;
    else textToCopy = item.title;

    navigator.clipboard.writeText(textToCopy);
    sound.click();
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'x_post':
        return <XIcon className="w-3.5 h-3.5 text-zinc-400" />;
      case 'reddit_post':
        return <span className="font-mono text-xs font-semibold">r/</span>;
      case 'instagram_post':
        return <InstagramIcon className="w-3.5 h-3.5 text-pink-500" />;
      case 'note':
        return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
      case 'secret':
        return <Key className="w-3.5 h-3.5 text-zinc-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />;
      case 'link':
        return <Link2 className="w-3.5 h-3.5 text-zinc-400" />;
      case 'code':
        return <Code2 className="w-3.5 h-3.5 text-zinc-400" />;
      case 'markdown':
        return <BookOpen className="w-3.5 h-3.5 text-zinc-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="memory-list w-full mx-auto py-2">
      <div className={`memory-list-surface rounded-2xl border overflow-hidden divide-y transition-colors ${
        isDark 
          ? 'bg-[#18181B] border-zinc-800 divide-zinc-800/80 shadow-md' 
          : 'bg-white border-zinc-200/90 divide-zinc-100 shadow-xs'
      }`}>
        <AnimatePresence mode="popLayout">
          {items.map((item) => {
            const formattedDate = new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
            }).format(new Date(item.createdAt));

            return (
              <motion.div
                key={item.id}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                tabIndex={0}
                aria-label={`Open ${getItemTitle(item)}`}
                onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenItem?.(item); } }}
                onClick={() => onOpenItem?.(item)}
                className={`memory-list-row ${item.isPinned ? 'is-pinned' : ''} group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 transition-colors gap-3 cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50/80'
                }`}
              >
                {/* Left section: Icon + Title + Meta */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                  }`}>
                    {getItemIcon(item.type)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-xs sm:text-sm truncate ${
                        isDark ? 'text-zinc-100' : 'text-zinc-900'
                      }`}>
                        {getItemTitle(item) || ('content' in item ? (item as any).content.slice(0, 40) : 'Untitled')}
                      </span>
                      {item.isPinned && (
                        <span className={`memory-list-pin text-[9px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                          isDark ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'bg-zinc-900 text-white'
                        }`}>
                          <Pin aria-hidden="true" />Pinned
                        </span>
                      )}
                      {folders.find((f) => f.id === item.folderId) && (
                        <span className={`memory-list-folder inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          isDark ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/60' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          <FolderIcon className="w-2.5 h-2.5 text-indigo-400" />
                          <span>{folders.find((f) => f.id === item.folderId)?.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right section: Date & Action buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                    {formattedDate}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.pin();
                        onTogglePin(item.id);
                      }}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        item.isPinned
                          ? (isDark ? 'text-white' : 'text-zinc-900')
                          : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                      title={item.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={(e) => handleCopy(e, item)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                      title="Copy"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.delete();
                        onDelete(item.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
