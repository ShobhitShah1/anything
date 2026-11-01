import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SavedItem, Folder } from '../types';
import { CardItem } from './CardItem';
import { useCollectionVirtualizer } from '../hooks/useCollectionVirtualizer';

interface MasonryGridProps {
  items: SavedItem[];
  folders: Folder[];
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  onOpenImage?: (imageUrl: string, title: string) => void;
  onOpenDetail?: (item: SavedItem) => void;
  activeId?: string | null;
  isDark?: boolean;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  items, folders, onTogglePin, onDelete, onUpdateItem, onOpenImage, onOpenDetail, activeId = null, isDark = true,
}) => {
  const reduceMotion = useReducedMotion();
  const { ref, virtualizer, cardWidth, top, focusProps } = useCollectionVirtualizer(items, activeId, true);
  const folderNames = useMemo(() => new Map(folders.map(folder => [folder.id, folder.name])), [folders]);

  return (
    <div ref={ref} {...focusProps} className="relative w-full" style={{ height: virtualizer.getTotalSize(), overflowAnchor: 'none' }}>
      {virtualizer.getVirtualItems().map(cell => {
        const item = items[cell.index];
        return (
          <motion.div key={item.id} ref={virtualizer.measureElement} data-index={cell.index} data-item-id={item.id}
            layout={reduceMotion || virtualizer.isScrolling ? false : 'position'}
            layoutDependency={items}
            transition={{ layout: { duration: 0.26, ease: [0.23, 1, 0.32, 1] } }}
            className="absolute top-0 left-0"
            style={{ width: cardWidth || '100%', top: cell.start - top, left: cell.lane * (cardWidth + 16) }}>
            <CardItem item={item} folderName={folderNames.get(item.folderId ?? '')}
              onTogglePin={onTogglePin} onDelete={onDelete} onUpdateItem={onUpdateItem}
              onOpenImage={onOpenImage} onOpenDetail={onOpenDetail} isDark={isDark} />
          </motion.div>
        );
      })}
    </div>
  );
};
