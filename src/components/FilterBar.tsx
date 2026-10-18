import React from 'react';
import { motion } from 'framer-motion';
import { 
  Pin, 
  BookOpen, 
  FileText, 
  Link2, 
  Code2, 
  KeyRound, 
  Image as ImageIcon,
  Layers
} from 'lucide-react';
import { ItemType, Folder } from '../types';
import { sound } from '../utils/sound';
import { InstagramIcon, RedditIcon, XIcon } from './Icons';
import { FolderDropdown } from './FolderDropdown';

export type FilterCategory = 'all' | 'pinned' | ItemType;
export type SortOption = 'newest' | 'oldest' | 'title';

interface FilterBarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder?: (name: string) => Folder;
  totalCount: number;

  selectedFilter: FilterCategory;
  onFilterChange: (cat: FilterCategory) => void;
  itemCounts: Record<string, number>;
  isDark?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  totalCount,
  selectedFilter,
  onFilterChange,
  itemCounts,
  isDark = false,
}) => {
  if (totalCount === 0 && folders.length === 0) return null;

  // STRICTLY MONOCHROME - zero rainbow colors!
  const categories: { id: FilterCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <Layers className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'pinned', label: 'Pinned', icon: <Pin className="w-3.5 h-3.5 shrink-0 fill-current text-zinc-400" /> },
    { id: 'markdown', label: 'Markdown', icon: <BookOpen className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'note', label: 'Notes', icon: <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'link', label: 'Links', icon: <Link2 className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'x_post', label: 'Posts', icon: <XIcon className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'reddit_post', label: 'Reddit', icon: <RedditIcon className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'instagram_post', label: 'Instagram', icon: <InstagramIcon className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'code', label: 'Code', icon: <Code2 className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'secret', label: 'Secrets', icon: <KeyRound className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
    { id: 'image', label: 'Images', icon: <ImageIcon className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {/* Left: Sleek Monochrome Folder Dropdown */}
        <FolderDropdown
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          onCreateFolder={onCreateFolder}
          isDark={isDark}
          emptyLabel="All Folders"
        />

        {/* Subtle Divider */}
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 shrink-0 mx-0.5" />

        {/* Monochrome Category Pills with stable hairline borders (ZERO flicker) */}
        {categories.map((cat) => {
          const count = itemCounts[cat.id] ?? 0;
          const isActive = selectedFilter === cat.id;

          if (count === 0 && cat.id !== 'all') return null;

          return (
            <button
              key={cat.id}
              onClick={() => {
                sound.click();
                onFilterChange(cat.id);
              }}
              className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 select-none transition-colors duration-150 ${
                isActive 
                  ? 'text-white font-semibold' 
                  : (isDark 
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50' 
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/70')
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeFilterPill"
                  className={`absolute inset-0 rounded-full border ${
                    isDark 
                      ? 'bg-zinc-800 border-zinc-700/80 shadow-xs' 
                      : 'bg-zinc-900 border-zinc-900 shadow-xs'
                  }`}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {cat.icon}
                <span>{cat.label}</span>
                <span className={`text-[10px] font-mono ${
                  isActive
                    ? (isDark ? 'text-zinc-300' : 'text-zinc-400')
                    : (isDark ? 'text-zinc-500' : 'text-zinc-400')
                }`}>
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
