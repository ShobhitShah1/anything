import React, { useMemo, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SavedItem, Folder } from '../types';
import { CardItem } from './CardItem';

interface MasonryGridProps {
  items: SavedItem[];
  folders: Folder[];
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  onOpenImage?: (imageUrl: string, title: string) => void;
  onOpenDetail?: (item: SavedItem) => void;
  isDark?: boolean;
}

function useColumnCount(): number {
  const [columns, setColumns] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const count = w < 640 ? 1 : w < 1024 ? 2 : 3;
      setColumns(count);
    };

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return columns;
}

function estimateItemHeight(item: SavedItem): number {
  const h = 100; // Base card header & padding

  switch (item.type) {
    case 'instagram_post':
      return h + 420;
    case 'image':
      return h + 300;
    case 'x_post':
      return h + (item.imageUrl ? 320 : 0) + Math.min(120, Math.ceil((item.content?.length || 0) / 30) * 20);
    case 'reddit_post':
      return h + (item.imageUrl ? 260 : 0) + Math.min(80, Math.ceil((item.content?.length || 0) / 30) * 18);
    case 'link':
      return h + 220 + Math.min(60, Math.ceil((item.description?.length || 0) / 30) * 18);
    case 'code':
      return h + Math.min(240, (item.code?.split('\n').length || 4) * 20);
    case 'markdown':
      return h + Math.min(220, ((item as any).content?.length || 0) * 0.4);
    case 'secret':
      return h + 90;
    case 'note':
    default:
      if (item.checklist && item.checklist.length > 0) {
        return h + item.checklist.length * 32;
      }
      return h + Math.min(180, Math.ceil((item.content?.length || 0) / 30) * 20);
  }
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  items,
  folders,
  onTogglePin,
  onDelete,
  onUpdateItem,
  onOpenImage,
  onOpenDetail,
  isDark = true,
}) => {
  const columnCount = useColumnCount();

  // Greedy shortest-column distribution:
  // Packs cards vertically with tight gap-6 (zero empty row dead spaces) while balancing column heights evenly
  const columns = useMemo(() => {
    const cols: SavedItem[][] = Array.from({ length: columnCount }, () => []);
    const heights = new Array(columnCount).fill(0);

    items.forEach((item) => {
      let minCol = 0;
      for (let i = 1; i < columnCount; i++) {
        if (heights[i] < heights[minCol]) {
          minCol = i;
        }
      }
      cols[minCol].push(item);
      heights[minCol] += estimateItemHeight(item) + 24;
    });

    return cols;
  }, [items, columnCount]);

  if (items.length === 0) return null;

  return (
    <div className="flex gap-6 items-start w-full">
      {columns.map((colItems, colIdx) => (
        <div key={`masonry-col-${colIdx}`} className="flex-1 flex flex-col gap-6 min-w-0">
          <AnimatePresence mode="popLayout" initial={false}>
            {colItems.map((item) => (
              <CardItem
                key={item.id}
                item={item}
                folderName={folders.find((f) => f.id === item.folderId)?.name}
                onTogglePin={onTogglePin}
                onDelete={onDelete}
                onUpdateItem={onUpdateItem}
                onOpenImage={onOpenImage}
                onOpenDetail={onOpenDetail}
                isDark={isDark}
              />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};
