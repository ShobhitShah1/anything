import React from 'react';
import { Pin } from 'lucide-react';
import { SavedItem, Folder } from '../types';
import { MasonryGrid } from './MasonryGrid';

interface PinnedShelfProps {
  pinnedItems: SavedItem[];
  folders?: Folder[];
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  onOpenImage?: (imageUrl: string, title: string) => void;
  onOpenDetail?: (item: SavedItem) => void;
  isDark?: boolean;
}

export const PinnedShelf: React.FC<PinnedShelfProps> = ({
  pinnedItems,
  folders = [],
  onTogglePin,
  onDelete,
  onUpdateItem,
  onOpenImage,
  onOpenDetail,
  isDark = false,
}) => {
  if (pinnedItems.length === 0) return null;

  return (
    <section className="w-full max-w-6xl mx-auto pt-2 pb-6">
      <div className={`flex items-center gap-2 mb-4 pb-2.5 border-b transition-colors ${
        isDark ? 'border-zinc-800/80 text-zinc-300' : 'border-zinc-200/60 text-zinc-800'
      }`}>
        <Pin className={`w-3.5 h-3.5 fill-current ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`} />
        <h2 className="text-xs font-semibold tracking-wide">
          Pinned
        </h2>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
          isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
        }`}>
          {pinnedItems.length}
        </span>
      </div>

      <MasonryGrid
        items={pinnedItems}
        folders={folders}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
        onUpdateItem={onUpdateItem}
        onOpenImage={onOpenImage}
        onOpenDetail={onOpenDetail}
        isDark={isDark}
      />
    </section>
  );
};
