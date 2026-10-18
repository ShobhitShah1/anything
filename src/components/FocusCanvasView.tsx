import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SavedItem } from '../types';
import { sound } from '../utils/sound';
import { CardItem } from './CardItem';

interface FocusCanvasViewProps {
  items: SavedItem[];
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  onOpenImage?: (imageUrl: string, title: string) => void;
  isDark?: boolean;
}

export const FocusCanvasView: React.FC<FocusCanvasViewProps> = ({
  items,
  onTogglePin,
  onDelete,
  onUpdateItem,
  onOpenImage,
  isDark = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length]);

  if (items.length === 0) {
    return (
      <div className="w-full max-w-xl mx-auto py-24 text-center">
        <p className="text-xs font-mono text-zinc-400">No items to focus</p>
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, items.length - 1);
  const currentItem = items[safeIndex];

  const handleNext = () => {
    sound.click();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    sound.click();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 flex flex-col items-center">
      {/* Navigation & Counter Bar */}
      <div className="w-full flex items-center justify-between pb-4 text-xs font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          <span>// focus mode</span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
            {safeIndex + 1} of {items.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:text-black'
            }`}
            title="Previous (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:text-black'
            }`}
            title="Next (→)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Focus Card with Spring Slide */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full"
          >
            <CardItem
              item={currentItem}
              onTogglePin={onTogglePin}
              onDelete={(id) => {
                onDelete(id);
                if (safeIndex >= items.length - 1) {
                  setCurrentIndex(Math.max(0, items.length - 2));
                }
              }}
              onUpdateItem={onUpdateItem}
              onOpenImage={onOpenImage}
              isDark={isDark}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mini indicator dots */}
      <div className="w-full flex items-center justify-center gap-1 pt-6 overflow-x-auto py-2">
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => {
              sound.click();
              setCurrentIndex(idx);
            }}
            className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
              idx === safeIndex
                ? (isDark ? 'w-6 bg-white' : 'w-6 bg-zinc-900')
                : (isDark ? 'w-1.5 bg-zinc-800 hover:bg-zinc-600' : 'w-1.5 bg-zinc-200 hover:bg-zinc-400')
            }`}
          />
        ))}
      </div>
    </div>
  );
};
