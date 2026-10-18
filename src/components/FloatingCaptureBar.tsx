import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, X } from 'lucide-react';
import { sound } from '../utils/sound';

interface FloatingCaptureBarProps {
  onOpenCapture: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isDark?: boolean;
}

export const FloatingCaptureBar: React.FC<FloatingCaptureBarProps> = ({
  onOpenCapture,
  searchQuery,
  onSearchChange,
  isDark = false,
}) => {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 350, damping: 25 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl"
    >
      <div className={`p-2 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-2.5 transition-colors ${
        isDark 
          ? 'bg-[#18181B]/90 border-zinc-700/80 shadow-black/50' 
          : 'bg-white/95 border-zinc-200/90 shadow-zinc-300/40'
      }`}>
        
        {/* Integrated Bottom Search Input */}
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search posts, notes, passwords... (/)"
            className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-xs sm:text-sm focus:outline-none transition-all ${
              isDark 
                ? 'bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:bg-zinc-800' 
                : 'bg-zinc-100 text-zinc-900 placeholder:text-zinc-400 focus:bg-zinc-50'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => {
                sound.click();
                onSearchChange('');
              }}
              className="absolute right-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Big Flex "+ Save New" Button */}
        <button
          onClick={() => {
            sound.pop();
            onOpenCapture();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all active:scale-95 shadow-md cursor-pointer shrink-0 ${
            isDark 
              ? 'bg-white text-zinc-950 hover:bg-zinc-200' 
              : 'bg-zinc-900 text-white hover:bg-black'
          }`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Save New</span>
          <kbd className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${
            isDark ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-800 text-zinc-300'
          }`}>
            ⌘K
          </kbd>
        </button>

      </div>
    </motion.div>
  );
};
