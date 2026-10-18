import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Clipboard, 
  Sparkles, 
  CheckSquare, 
  Square, 
  Eye, 
  EyeOff, 
  Heart, 
  KeyRound, 
  ArrowRight,
  Command,
  Layers,
  Sparkle
} from 'lucide-react';
import { sound } from '../utils/sound';
import { CURATED_STARTER_ITEMS } from '../utils/starterItems';
import { SavedItem } from '../types';
import { XIcon } from './Icons';

const ROTATING_ITEMS = [
  {
    title: 'Capture thoughts.',
    desc: 'Instant distraction-free notes, markdown documents, and tasks.',
  },
  {
    title: 'Bookmark posts.',
    desc: 'Live tweet previews, author avatars, and engagement metrics.',
  },
  {
    title: 'Store clean code.',
    desc: 'Syntax-highlighted TypeScript, Rust, Python, and shell snippets.',
  },
  {
    title: 'Stash secret keys.',
    desc: 'Encrypted tokens, API keys, and credentials with AES reveal.',
  },
  {
    title: 'Collect web links.',
    desc: 'Rich link metadata, live favicon extraction, and summary cards.',
  },
  {
    title: 'Capture anything.',
    desc: 'Your calm personal canvas. Everything saved locally with zero tracking.',
  },
];

interface CreativeEmptyViewProps {
  onOpenCapture: () => void;
  onDirectPaste: () => void;
  onLoadStarters: (items: SavedItem[]) => void;
  isDark?: boolean;
}

export const CreativeEmptyView: React.FC<CreativeEmptyViewProps> = ({
  onOpenCapture,
  onDirectPaste,
  onLoadStarters,
  isDark = true,
}) => {
  const [targetIndex, setTargetIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTargetIndex((prev) => (prev + 1) % ROTATING_ITEMS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  // Interactive demo states for the on-screen motion canvas
  const [demoLikes, setDemoLikes] = useState(142);
  const [demoLiked, setDemoLiked] = useState(false);
  const [showDemoSecret, setShowDemoSecret] = useState(false);
  const [demoChecklist, setDemoChecklist] = useState([
    { id: '1', text: 'Fast keyboard shortcuts (Ctrl+K or C)', completed: true },
    { id: '2', text: 'Direct clipboard paste without modals (Ctrl+V)', completed: true },
    { id: '3', text: 'Fluid deceleration curve ([0.16, 1, 0.3, 1])', completed: false },
  ]);

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.pop();
    if (demoLiked) {
      setDemoLikes((prev) => prev - 1);
      setDemoLiked(false);
    } else {
      setDemoLikes((prev) => prev + 1);
      setDemoLiked(true);
    }
  };

  const handleToggleChecklist = (id: string) => {
    sound.click();
    setDemoChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c))
    );
  };

  return (
    <div className="min-h-[72vh] flex flex-col items-center justify-center max-w-4xl mx-auto px-4 py-8 text-center select-none">
      {/* Ambient Motion Floating Halo directly on canvas */}
      <motion.div
        animate={{ 
          scale: [1, 1.08, 1],
          opacity: isDark ? [0.15, 0.3, 0.15] : [0.08, 0.18, 0.08]
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-96 h-96 rounded-full bg-gradient-to-tr from-zinc-500/20 to-zinc-400/10 pointer-events-none blur-3xl -z-10"
      />

      {/* Brand Hero Header with High-Craft Animated Changing Text (NO resizing, NO subtitle reflow) */}
      <div className="flex flex-col items-center mb-10">
        <div className="min-h-[54px] sm:min-h-[72px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.h1
              key={targetIndex}
              initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.035em] text-white text-center"
            >
              {ROTATING_ITEMS[targetIndex].title.split(' ')[0]}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400">
                {ROTATING_ITEMS[targetIndex].title.split(' ').slice(1).join(' ')}
              </span>
            </motion.h1>
          </AnimatePresence>
        </div>
      </div>

      {/* On-Screen Interactive Motion Showcase Cards (Floating on the canvas) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left"
      >
        {/* Interactive Card 1: X Tweet Post */}
        <motion.div 
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all select-none ${
            isDark ? 'bg-[#18181B] border-zinc-800' : 'bg-white border-zinc-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                <XIcon className="w-3 h-3 text-zinc-300 shrink-0" />
                <span>Post</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Live Demo</span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700/60 flex items-center justify-center text-white shrink-0">
                <XIcon className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold leading-tight">Satya</p>
                <p className="text-[10px] text-zinc-400 font-mono">@heysatya_</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-3">
              Onboarding designing for a modern app. Focus on fluid deceleration physics and zero unnecessary decoration.
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <button
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                demoLiked ? 'text-zinc-900 dark:text-zinc-100 font-semibold' : 'hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${demoLiked ? 'fill-current' : ''}`} />
              <span>{demoLikes}</span>
            </button>
            <span className="text-[10px] font-mono">Tap to like</span>
          </div>
        </motion.div>

        {/* Interactive Card 2: Interactive Tasks Checklist */}
        <motion.div 
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all select-none ${
            isDark ? 'bg-[#18181B] border-zinc-800' : 'bg-white border-zinc-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                <CheckSquare className="w-3 h-3 text-zinc-400" />
                <span>Tasks</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Interactive</span>
            </div>

            <h4 className="text-xs font-semibold mb-2">Checklist Demo</h4>

            <div className="space-y-1.5">
              {demoChecklist.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleToggleChecklist(c.id)}
                  className="flex items-center gap-2 text-xs cursor-pointer group"
                >
                  {c.completed ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 shrink-0" />
                  )}
                  <span className={`truncate text-[11px] ${c.completed ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {c.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>{demoChecklist.filter((c) => c.completed).length}/{demoChecklist.length} completed</span>
            <span>Tap to toggle</span>
          </div>
        </motion.div>

        {/* Interactive Card 3: Cryptographic Secret Key */}
        <motion.div 
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all select-none ${
            isDark ? 'bg-[#18181B] border-zinc-800' : 'bg-white border-zinc-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'
              }`}>
                <KeyRound className="w-3 h-3 text-zinc-400" />
                <span>Secret Key</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-500 font-medium">Encrypted</span>
            </div>

            <h4 className="text-xs font-semibold mb-2">GitHub Token</h4>

            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
            }`}>
              <span className="font-mono text-xs tracking-wider text-zinc-400 truncate">
                {showDemoSecret ? 'ghp_4kL89mXzQ1wP7vR3t' : '••••••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setShowDemoSecret(!showDemoSecret);
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer ml-2"
              >
                {showDemoSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>256-bit AES</span>
            <span>Tap eye to view</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Action Dock */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-center gap-3 mb-8"
      >
        {/* Primary Save Action */}
        <button
          onClick={() => {
            sound.pop();
            onOpenCapture();
          }}
          className={`px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer active:scale-95 flex items-center gap-2 ${
            isDark ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-black'
          }`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Save something (Ctrl+K)</span>
        </button>

        {/* Direct Native Paste from Clipboard */}
        <button
          onClick={() => {
            sound.click();
            onDirectPaste();
          }}
          className={`px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2 ${
            isDark 
              ? 'border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-850' 
              : 'border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <Clipboard className="w-4 h-4 text-zinc-400" />
          <span>Paste from Clipboard (Ctrl+V)</span>
        </button>

        {/* Load Curated Starters */}
        <button
          onClick={() => {
            sound.save();
            onLoadStarters(CURATED_STARTER_ITEMS);
          }}
          className={`px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2 ${
            isDark 
              ? 'border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-850' 
              : 'border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-zinc-400" />
          <span>Load 4 Starters</span>
        </button>
      </motion.div>

      {/* Keyboard Shortcuts Footer Pill */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-400 font-mono"
      >
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-[10px]">
            Ctrl+K
          </kbd>
          <span>Capture</span>
        </span>

        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-[10px]">
            Ctrl+V
          </kbd>
          <span>Direct Paste</span>
        </span>

        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-[10px]">
            /
          </kbd>
          <span>Search</span>
        </span>
      </motion.div>
    </div>
  );
};
