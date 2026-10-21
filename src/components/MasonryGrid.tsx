import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SavedItem, Folder } from '../types';
import { CardItem } from './CardItem';
import { packMasonry } from '../utils/masonry';

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

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  items, folders, onTogglePin, onDelete, onUpdateItem, onOpenImage, onOpenDetail, isDark = true,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const columnCount = Math.max(1, Math.floor((width + 16) / 296));
  const cardWidth = Math.max(0, (width - (columnCount - 1) * 16) / columnCount);
  const layout = packMasonry(items.map(item => heights[item.id] || 0), columnCount, 16);

  useEffect(() => {
    // Reveal cached images together after decoding, without a placeholder flash.
    const grid = gridRef.current;
    if (!grid) return;
    let cancelled = false;
    let frame = 0;
    let deadline = 0;
    const images = Array.from(grid.querySelectorAll<HTMLImageElement>('img'))
      .filter(image => image.getBoundingClientRect().top < window.innerHeight);
    const settled = images.map(image => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    });
    // A slow remote image must not hold up the collection.
    void Promise.race([
      Promise.all([...settled, document.fonts.ready]),
      new Promise<void>(resolve => { deadline = window.setTimeout(resolve, 250); }),
    ]).then(() => {
      clearTimeout(deadline);
      if (!cancelled) frame = requestAnimationFrame(() => setReady(true));
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); clearTimeout(deadline); };
  }, []);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      setWidth(grid.clientWidth);
      const next: Record<string, number> = {};
      grid.querySelectorAll<HTMLElement>('[data-masonry-id]').forEach(element => {
        next[element.dataset.masonryId!] = (element.firstElementChild as HTMLElement).offsetHeight;
      });
      setHeights(previous => Object.keys(next).length === Object.keys(previous).length &&
        Object.keys(next).every(id => next[id] === previous[id]) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid.querySelectorAll('[data-masonry-id] > *').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [items, cardWidth]);

  return (
    <div ref={gridRef} className="relative w-full" aria-busy={!ready} style={{ height: layout.height, visibility: width > 0 && ready ? 'visible' : 'hidden' }}>
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            data-masonry-id={item.id}
            layout={reduceMotion || !ready ? false : 'position'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ layout: { duration: 0.26, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0.16 } }}
            className="absolute top-0 left-0"
            style={{ width: cardWidth || '100%', top: layout.positions[index].top, left: layout.positions[index].column * (cardWidth + 16) }}
          >
            <CardItem
              item={item}
              folderName={folders.find(folder => folder.id === item.folderId)?.name}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onUpdateItem={onUpdateItem}
              onOpenImage={onOpenImage}
              onOpenDetail={onOpenDetail}
              isDark={isDark}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
