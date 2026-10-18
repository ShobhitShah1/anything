import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder as FolderIcon, ChevronDown, Check, Plus, X } from 'lucide-react';
import { Folder } from '../types';
import { sound } from '../utils/sound';

interface FolderDropdownProps {
  folders: Folder[];
  selectedFolderId?: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder?: (name: string) => Folder;
  isDark: boolean;
  className?: string;
  emptyLabel?: string;
}

export const FolderDropdown: React.FC<FolderDropdownProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  isDark,
  className = '',
  emptyLabel = 'No Folder',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !onCreateFolder) return;
    const created = onCreateFolder(newFolderName.trim());
    onSelectFolder(created.id);
    setNewFolderName('');
    setIsCreating(false);
    setIsOpen(false);
    sound.pop();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          sound.click();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
          isDark
            ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
            : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
        }`}
      >
        <FolderIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="truncate max-w-[140px]">
          {selectedFolder ? selectedFolder.name : emptyLabel}
        </span>
        <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
      </button>

      {/* Custom Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute left-0 top-full mt-1.5 w-56 rounded-2xl border shadow-xl z-50 p-1.5 overflow-hidden ${
              isDark
                ? 'bg-[#18181B] border-zinc-800 text-zinc-200 shadow-black/60'
                : 'bg-white border-zinc-200 text-zinc-800 shadow-zinc-300/50'
            }`}
          >
            {/* Empty/All Option */}
            <button
              type="button"
              onClick={() => {
                sound.click();
                onSelectFolder(null);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                !selectedFolderId
                  ? (isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-950')
                  : (isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50')
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>{emptyLabel}</span>
              </div>
              {!selectedFolderId && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />}
            </button>

            {/* Folder List */}
            {folders.length > 0 && (
              <div className="my-1 border-t border-zinc-200/50 dark:border-zinc-800/80 pt-1 space-y-0.5 max-h-48 overflow-y-auto no-scrollbar">
                {folders.map((f) => {
                  const isSelected = selectedFolderId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        sound.click();
                        onSelectFolder(f.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? (isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-950')
                          : (isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50')
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FolderIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Inline Add Folder */}
            {onCreateFolder && (
              <div className="pt-1 mt-1 border-t border-zinc-200/50 dark:border-zinc-800/80">
                {!isCreating ? (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer font-medium`}
                  >
                    <Plus className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Create New Folder</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreate} className="p-1 space-y-1.5">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name..."
                      autoFocus
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                      }`}
                    />
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newFolderName.trim()}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-lg cursor-pointer disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
