import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/react-virtual';
import type { SavedItem } from '../types';

export function useCollectionVirtualizer(items: SavedItem[], activeId: string | null, masonry = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ width: 0, top: 0 });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const columns = masonry ? Math.max(1, Math.floor((geometry.width + 16) / 296)) : 1;
  const cardWidth = Math.max(0, (geometry.width - (columns - 1) * 16) / columns);
  const activeIndex = items.findIndex(item => item.id === activeId);
  const focusedIndex = items.findIndex(item => item.id === focusedId);
  const getItemKey = useCallback((index: number) => items[index].id, [items]);
  const rangeExtractor = useCallback((range: Range) => {
    // Retain the shared transition's source and keyboard focus outside the window.
    const indexes = new Set(defaultRangeExtractor(range));
    if (activeIndex >= 0) indexes.add(activeIndex);
    if (focusedIndex >= 0) {
      for (const index of [focusedIndex - 1, focusedIndex, focusedIndex + 1]) {
        if (index >= 0 && index < range.count) indexes.add(index);
      }
    }
    return [...indexes].sort((a, b) => a - b);
  }, [activeIndex, focusedIndex]);
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: items.length,
    getItemKey,
    estimateSize: () => masonry ? 320 : geometry.width < 640 ? 112 : 68,
    lanes: columns,
    laneAssignmentMode: 'measured',
    gap: masonry ? 16 : 0,
    overscan: 4,
    scrollMargin: geometry.top,
    rangeExtractor,
    // Animated transforms must never feed back into size measurement.
    measureElement: element => element.offsetHeight,
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const top = element.getBoundingClientRect().top + window.scrollY;
      setGeometry(previous => previous.width === width && Math.abs(previous.top - top) < 1 ? previous : { width, top });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useLayoutEffect(() => {
    virtualizer.measure();
    ref.current?.querySelectorAll<HTMLDivElement>('[data-index]').forEach(virtualizer.measureElement);
  }, [cardWidth, virtualizer]);

  return { ref, virtualizer, columns, cardWidth, top: geometry.top,
    focusProps: {
      onFocusCapture: (event: React.FocusEvent<HTMLDivElement>) => {
        setFocusedId((event.target as HTMLElement).closest<HTMLElement>('[data-item-id]')?.dataset.itemId ?? null);
      },
      onBlurCapture: (event: React.FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null);
      },
    },
  };
}
