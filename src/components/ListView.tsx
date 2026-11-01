import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pin, Trash2, ArrowUpRight, Copy, Check, Key, FileText, Image as ImageIcon, Link2, Code2, BookOpen, Folder as FolderIcon } from 'lucide-react';
import { SavedItem, Folder } from '../types';
import { getItemTitle } from '../utils/itemTitle';
import { sound } from '../utils/sound';
import { InstagramIcon, XIcon } from './Icons';
import { useCollectionVirtualizer } from '../hooks/useCollectionVirtualizer';

interface ListViewProps {
  items: SavedItem[];
  folders?: Folder[];
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenItem?: (item: SavedItem) => void;
  isDark?: boolean;
  activeId?: string | null;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const icons = { note: FileText, markdown: BookOpen, image: ImageIcon, link: Link2, code: Code2, secret: Key };

const ListRow = React.memo(function ListRow({ item, folderName, onTogglePin, onDelete, onOpenItem, isDark }: {
  item: SavedItem;
  folderName?: string;
} & Pick<ListViewProps, 'onTogglePin' | 'onDelete' | 'onOpenItem' | 'isDark'>) {
  const [copied, setCopied] = useState(false);
  const Icon = icons[item.type as keyof typeof icons];
  const title = getItemTitle(item) || ('content' in item ? item.content.slice(0, 40) : '') || 'Untitled';
  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    const content = 'postUrl' in item && item.postUrl ? item.postUrl
      : 'url' in item && item.url ? item.url
      : 'secretValue' in item ? item.secretValue
      : 'content' in item ? item.content
      : 'code' in item ? item.code : item.title;
    navigator.clipboard.writeText(content);
    sound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div data-card-id={item.id} tabIndex={0} aria-label={`Open ${title}`}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); onOpenItem?.(item);
        }
      }}
      onClick={() => onOpenItem?.(item)}
      className={`memory-list-row ${item.isPinned ? 'is-pinned' : ''} group flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50/80'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center shrink-0 text-zinc-400" aria-hidden="true">
          {Icon ? <Icon className="w-3.5 h-3.5" /> : item.type === 'x_post' ? <XIcon className="w-3.5 h-3.5" /> : item.type === 'instagram_post' ? <InstagramIcon className="w-3.5 h-3.5 text-pink-500" /> : <span className="font-mono text-xs font-semibold">r/</span>}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-medium text-xs sm:text-sm truncate ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{title || 'Untitled'}</span>
          {item.isPinned && <span className="memory-list-pin text-[9px] px-1.5 rounded shrink-0"><Pin aria-hidden="true" />Pinned</span>}
          {folderName && <span className={`memory-list-folder inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/60' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}><FolderIcon className="w-2.5 h-2.5 text-indigo-400" /><span>{folderName}</span></span>}
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">{dateFormatter.format(new Date(item.createdAt))}</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={item.isPinned ? 'Unpin' : 'Pin'} aria-pressed={item.isPinned} title={item.isPinned ? 'Unpin' : 'Pin'} onClick={event => { event.stopPropagation(); sound.pin(); onTogglePin(item.id); }} className={`p-1.5 rounded-lg cursor-pointer transition-colors ${item.isPinned ? (isDark ? 'text-white' : 'text-zinc-900') : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'}`}><Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} /></button>
          <button type="button" aria-label="Copy" title="Copy" onClick={handleCopy} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
          <button type="button" aria-label="Delete" title="Delete" onClick={event => { event.stopPropagation(); sound.delete(); onDelete(item.id); }} className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" aria-hidden="true"><ArrowUpRight className="w-3.5 h-3.5" /></span>
        </div>
      </div>
    </div>
  );
});

export const ListView: React.FC<ListViewProps> = ({ items, folders = [], onTogglePin, onDelete, onOpenItem, isDark = false, activeId = null }) => {
  const reduceMotion = useReducedMotion();
  const { ref, virtualizer, top, focusProps } = useCollectionVirtualizer(items, activeId);
  const folderNames = useMemo(() => new Map(folders.map(folder => [folder.id, folder.name])), [folders]);
  return (
    <div className="memory-list w-full mx-auto py-2">
      <div ref={ref} {...focusProps} style={{ position: 'relative', height: virtualizer.getTotalSize(), overflowAnchor: 'none' }} className={`memory-list-surface rounded-2xl border overflow-hidden transition-colors ${isDark ? 'bg-[#18181B] border-zinc-800 shadow-md' : 'bg-white border-zinc-200/90 shadow-xs'}`}>
        {virtualizer.getVirtualItems().map(cell => {
          const item = items[cell.index];
          return <motion.div key={item.id} ref={virtualizer.measureElement} data-index={cell.index} data-item-id={item.id}
            layout={reduceMotion || virtualizer.isScrolling ? false : 'position'} layoutDependency={items}
            style={{ position: 'absolute', top: cell.start - top, left: 0, width: '100%' }}
            transition={{ layout: { duration: 0.26, ease: [0.23, 1, 0.32, 1] } }}>
            <ListRow item={item} folderName={folderNames.get(item.folderId ?? '')} onTogglePin={onTogglePin} onDelete={onDelete} onOpenItem={onOpenItem} isDark={isDark} />
          </motion.div>;
        })}
      </div>
    </div>
  );
};
