import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder as FolderIcon, Plus, X, MoreHorizontal, Trash2 } from 'lucide-react';
import { Folder } from '../types';
import { sound } from '../utils/sound';

interface FolderBarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => Folder;
  onDeleteFolder: (folderId: string) => void;
  folderCounts: Record<string, number>;
  totalCount: number;
  isDark?: boolean;
}

export const FolderBar: React.FC<FolderBarProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  folderCounts,
  totalCount,
  isDark = false,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const folder = onCreateFolder(newFolderName.trim());
    onSelectFolder(folder.id);
    setNewFolderName('');
    setIsAdding(false);
    sound.pop();
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-4 pb-1">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {/* All Items Pill */}
        <button
          onClick={() => {
            sound.click();
            onSelectFolder(null);
          }}
          className={`relative px-4 py-2 sm:px-4.5 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            selectedFolderId === null
              ? (isDark ? 'text-white font-semibold' : 'text-zinc-950 font-semibold')
              : (isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/70')
          }`}
        >
          {selectedFolderId === null && (
            <motion.div
              layoutId="activeFolderPill"
              className={`absolute inset-0 rounded-2xl border shadow-xs ${
                isDark ? 'bg-zinc-800 border-zinc-700/80 shadow-md' : 'bg-white border-zinc-200/90 shadow-sm'
              }`}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <FolderIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>All Folders</span>
            <span className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
              selectedFolderId === null
                ? (isDark ? 'bg-zinc-700/80 text-zinc-200' : 'bg-zinc-100 text-zinc-700')
                : (isDark ? 'text-zinc-500' : 'text-zinc-400')
            }`}>
              {totalCount}
            </span>
          </span>
        </button>

        {/* Individual Folder Pills */}
        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          const count = folderCounts[folder.id] || 0;

          return (
            <div key={folder.id} className="relative group shrink-0">
              <button
                onClick={() => {
                  sound.click();
                  onSelectFolder(folder.id);
                }}
                className={`relative px-4 py-2 sm:px-4.5 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? (isDark ? 'text-white font-semibold' : 'text-zinc-950 font-semibold')
                    : (isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/70')
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeFolderPill"
                    className={`absolute inset-0 rounded-2xl border shadow-xs ${
                      isDark ? 'bg-zinc-800 border-zinc-700/80 shadow-md' : 'bg-white border-zinc-200/90 shadow-sm'
                    }`}
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <FolderIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{folder.name}</span>
                  <span className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? (isDark ? 'bg-zinc-700/80 text-zinc-200' : 'bg-zinc-100 text-zinc-700')
                      : (isDark ? 'text-zinc-500' : 'text-zinc-400')
                  }`}>
                    {count}
                  </span>
                </span>
              </button>

              {/* Delete custom folder button on hover */}
              {folders.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sound.delete();
                    onDeleteFolder(folder.id);
                    if (selectedFolderId === folder.id) onSelectFolder(null);
                  }}
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-xs"
                  title="Delete folder"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Folder Inline Button */}
        {!isAdding ? (
          <button
            onClick={() => {
              sound.click();
              setIsAdding(true);
            }}
            className={`px-3.5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-dashed ${
              isDark 
                ? 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/40' 
                : 'border-zinc-300 text-zinc-600 hover:text-zinc-950 hover:border-zinc-400 hover:bg-zinc-50'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Folder</span>
          </button>
        ) : (
          <form onSubmit={handleCreate} className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              autoFocus
              className={`px-3.5 py-1.5 sm:py-2 rounded-2xl text-xs sm:text-sm border focus:outline-none w-32 sm:w-40 transition-colors ${
                isDark 
                  ? 'bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500' 
                  : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
              }`}
            />
            <button
              type="submit"
              className="px-3 py-1.5 sm:py-2 rounded-2xl text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 cursor-pointer shadow-xs active:scale-95 transition-all"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
