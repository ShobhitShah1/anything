import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SavedItem, ViewMode, ItemType, Folder } from './types';
import { loadSavedItems, saveItemsToStorage, loadFolders, saveFolders } from './utils/storage';
import { sound } from './utils/sound';
import { Header } from './components/Header';
import { FilterBar, FilterCategory, SortOption } from './components/FilterBar';
import { PinnedShelf } from './components/PinnedShelf';
import { MasonryGrid } from './components/MasonryGrid';
import { CardItem } from './components/CardItem';
import { ListView } from './components/ListView';
import { FocusCanvasView } from './components/FocusCanvasView';
import { CaptureSheet } from './components/CaptureSheet';
import { CardDetailModal } from './components/CardDetailModal';
import { WholeViewModal } from './components/WholeViewModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { FloatingCaptureBar } from './components/FloatingCaptureBar';
import { CreativeEmptyView } from './components/CreativeEmptyView';
import { readClipboardSafely, autoDetectClipboardContent, findDuplicateItem } from './utils/clipboard';
import { Plus, ClipboardCheck, AlertCircle } from 'lucide-react';

export function App() {
  const [items, setItems] = useState<SavedItem[]>(() => loadSavedItems());
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('masonry');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Theme: Permanently Dark (White mode removed)
  const isDark = true;

  // Modals & Sheets
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureInitialType, setCaptureInitialType] = useState<ItemType>('note');
  const [captureInitialContent, setCaptureInitialContent] = useState<string>('');
  const [captureInitialTitle, setCaptureInitialTitle] = useState<string>('');
  
  // Card Detail Modal
  const [detailItem, setDetailItem] = useState<SavedItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Whole View (Full Canvas / Page Reader & Editor)
  const [wholeViewItem, setWholeViewItem] = useState<SavedItem | null>(null);
  const [isWholeViewOpen, setIsWholeViewOpen] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState<{ isOpen: boolean; imageUrl: string | null; title: string | null }>({
    isOpen: false,
    imageUrl: null,
    title: null,
  });

  // Clipboard toast
  const [clipboardNotice, setClipboardNotice] = useState<{
    text: string;
    isDuplicate: boolean;
    duplicateTitle?: string;
  } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    localStorage.setItem('anything_theme', 'dark');
  }, []);

  useEffect(() => {
    saveItemsToStorage(items);
  }, [items]);

  useEffect(() => {
    saveFolders(folders);
  }, [folders]);

  // Direct native clipboard paste without modal
  const handleDirectPaste = async () => {
    sound.click();
    const res = await readClipboardSafely();
    if (res.text && res.text.trim()) {
      const detected = autoDetectClipboardContent(res.text.trim());
      handleOpenStudioWithContent(detected.type, res.text.trim(), detected.title);
    } else {
      handleOpenCapture('note');
    }
  };

  // Global Keyboard Shortcuts (Ctrl+K, C, N, Esc, /, T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K / ⌘K -> Open Capture
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        sound.pop();
        handleOpenCapture('note');
        return;
      }

      // Esc -> Close any open modal or sheet
      if (e.key === 'Escape') {
        if (isCaptureOpen) setIsCaptureOpen(false);
        if (isDetailOpen) setIsDetailOpen(false);
        if (isWholeViewOpen) setIsWholeViewOpen(false);
        if (lightbox.isOpen) setLightbox({ isOpen: false, imageUrl: null, title: null });
        return;
      }

      // Shortcuts when not actively typing inside an input
      if (!isInput && !isCaptureOpen && !isDetailOpen && !isWholeViewOpen && !lightbox.isOpen) {
        // 'c' or 'n' -> New Capture
        if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'n') {
          e.preventDefault();
          sound.pop();
          handleOpenCapture('note');
          return;
        }

        // '/' -> Focus Search bar
        if (e.key === '/') {
          e.preventDefault();
          sound.click();
          const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) searchInput.focus();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCaptureOpen, isDetailOpen, isWholeViewOpen, lightbox.isOpen, isDark]);

  // Global direct paste detection (Ctrl+V directly opens capture with content prefilled)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      const text = e.clipboardData?.getData('text');
      if (text && text.trim().length > 0) {
        e.preventDefault();
        sound.pop();
        const detected = autoDetectClipboardContent(text.trim());
        handleOpenStudioWithContent(detected.type, text.trim(), detected.title);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleTogglePin = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isPinned: !item.isPinned } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (updated: SavedItem) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    if (detailItem?.id === updated.id) {
      setDetailItem(updated);
    }
    if (wholeViewItem?.id === updated.id) {
      setWholeViewItem(updated);
    }
  };

  const handleSaveNewItem = (newItem: SavedItem) => {
    setItems((prev) => [newItem, ...prev]);
  };

  const handleImportItems = (newItems: SavedItem[]) => {
    setItems(newItems);
  };

  const handleOpenCapture = (type: ItemType = 'note') => {
    setCaptureInitialType(type);
    setCaptureInitialContent('');
    setCaptureInitialTitle('');
    setIsCaptureOpen(true);
  };

  const handleOpenDetail = (item: SavedItem) => {
    sound.click();
    // If it's a markdown or skill document, directly open Whole View for full distraction-free reading/editing!
    if (item.type === 'markdown') {
      setWholeViewItem(item);
      setIsWholeViewOpen(true);
    } else {
      setDetailItem(item);
      setIsDetailOpen(true);
    }
  };

  const handleOpenWholeView = (item: SavedItem) => {
    sound.click();
    setIsDetailOpen(false);
    setWholeViewItem(item);
    setIsWholeViewOpen(true);
  };

  const handleOpenImage = (imageUrl: string, title: string) => {
    sound.click();
    setLightbox({ isOpen: true, imageUrl, title });
  };

  // Folder Operations
  const handleCreateFolder = (name: string): Folder => {
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, newFolder]);
    return newFolder;
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setItems((prev) =>
      prev.map((item) => (item.folderId === folderId ? { ...item, folderId: undefined } : item))
    );
  };

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      if (item.folderId) {
        counts[item.folderId] = (counts[item.folderId] || 0) + 1;
      }
    });
    return counts;
  }, [items]);

  const handleReadClipboard = () => {
    handleDirectPaste();
  };

  const handleOpenStudioWithContent = (type: ItemType, content: string, title?: string) => {
    setCaptureInitialType(type);
    setCaptureInitialContent(content);
    setCaptureInitialTitle(title || '');
    setIsCaptureOpen(true);
  };

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      item.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [items]);

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
      pinned: items.filter((i) => i.isPinned).length,
    };
    items.forEach((i) => {
      counts[i.type] = (counts[i.type] || 0) + 1;
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Folder filter
        if (selectedFolderId !== null) {
          if (item.folderId !== selectedFolderId) return false;
        }

        // Category filter
        if (selectedFilter === 'pinned') {
          if (!item.isPinned) return false;
        } else if (selectedFilter !== 'all') {
          if (item.type !== selectedFilter) return false;
        }

        // Tag filter
        if (selectedTag && !item.tags?.includes(selectedTag)) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title?.toLowerCase().includes(q);
          const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q));
          let matchContent = false;

          if ('content' in item && item.content) {
            matchContent = item.content.toLowerCase().includes(q);
          } else if ('description' in item && item.description) {
            matchContent = item.description.toLowerCase().includes(q);
          } else if ('authorHandle' in item && item.authorHandle) {
            matchContent = item.authorHandle.toLowerCase().includes(q);
          }

          if (!matchTitle && !matchTags && !matchContent) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'newest') return b.createdAt - a.createdAt;
        if (sortOption === 'oldest') return a.createdAt - b.createdAt;
        if (sortOption === 'title') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [items, selectedFolderId, selectedFilter, selectedTag, searchQuery, sortOption]);

  const isDefaultOverview = selectedFilter === 'all' && !searchQuery.trim() && !selectedTag && selectedFolderId === null;
  const pinnedItems = useMemo(() => filteredItems.filter((i) => i.isPinned), [filteredItems]);
  const unpinnedItems = useMemo(
    () => filteredItems.filter((i) => !i.isPinned),
    [filteredItems]
  );

  const gridItems = useMemo(() => {
    if (selectedFilter === 'pinned') return pinnedItems;
    if (isDefaultOverview) {
      return [...pinnedItems, ...unpinnedItems];
    }
    return filteredItems;
  }, [selectedFilter, isDefaultOverview, pinnedItems, unpinnedItems, filteredItems]);

  return (
    <div id="top" className="min-h-screen flex flex-col font-sans pb-32 bg-[#09090B] text-[#F4F4F5]">
      
      {/* Top Header */}
      <Header
        items={items}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenCapture={() => handleOpenCapture('note')}
        onImportItems={handleImportItems}
        isDark={true}
        onReadClipboard={handleReadClipboard}
      />

      {/* Clipboard Toast Banner */}
      <AnimatePresence>
        {clipboardNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4"
          >
            <div className={`p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3 text-sm ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
            }`}>
              <div className="flex items-center gap-3 truncate min-w-0">
                {clipboardNotice.isDuplicate ? (
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <ClipboardCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                <div className="truncate">
                  {clipboardNotice.isDuplicate ? (
                    <span>Already saved: <strong>{clipboardNotice.duplicateTitle}</strong></span>
                  ) : (
                    <span>Clipboard: <em>{clipboardNotice.text.slice(0, 36)}...</em></span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!clipboardNotice.isDuplicate && (
                  <button
                    onClick={() => {
                      setClipboardNotice(null);
                      handleOpenCapture('link');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-medium text-xs cursor-pointer transition-colors ${
                      isDark ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-black'
                    }`}
                  >
                    Save this
                  </button>
                )}
                <button
                  onClick={() => setClipboardNotice(null)}
                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Monochrome Filter & Folder Toolbar */}
      <FilterBar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        totalCount={items.length}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        itemCounts={itemCounts}
        isDark={isDark}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-4">
        
        {/* Creative Empty Canvas (Centered, with on-screen motion canvas) */}
        {items.length === 0 ? (
          <CreativeEmptyView
            onOpenCapture={() => handleOpenCapture('note')}
            onDirectPaste={handleDirectPaste}
            onLoadStarters={handleImportItems}
            isDark={isDark}
          />
        ) : (
          <>
              {/* Masonry View */}
              {viewMode === 'masonry' && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`masonry-view-${selectedFilter}-${selectedFolderId || 'all'}-${searchQuery}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {gridItems.length === 0 ? (
                      <div className="py-20 text-center">
                        <p className="text-sm text-zinc-400">No items match your search or filter</p>
                      </div>
                    ) : (
                      <MasonryGrid
                        items={gridItems}
                        folders={folders}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDeleteItem}
                        onUpdateItem={handleUpdateItem}
                        onOpenImage={handleOpenImage}
                        onOpenDetail={handleOpenDetail}
                        isDark={isDark}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <ListView
                  items={filteredItems}
                  folders={folders}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDeleteItem}
                  onOpenItem={handleOpenDetail}
                  isDark={isDark}
                />
              )}

            {/* Focus View */}
            {viewMode === 'focus' && (
              <FocusCanvasView
                items={filteredItems}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteItem}
                onUpdateItem={handleUpdateItem}
                onOpenImage={handleOpenImage}
                isDark={isDark}
              />
            )}
          </>
        )}

      </main>

      {/* Floating Bottom Dock with Integrated Search & Save Button (Hidden when empty!) */}
      {items.length > 0 && (
        <FloatingCaptureBar
          onOpenCapture={() => handleOpenCapture('note')}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isDark={isDark}
        />
      )}

      {/* Modern Slide-over Capture Sheet with Markdown, Skills, Folders & Live Preview */}
      <CaptureSheet
        isOpen={isCaptureOpen}
        onClose={() => {
          setIsCaptureOpen(false);
          setCaptureInitialContent('');
          setCaptureInitialTitle('');
        }}
        onSave={handleSaveNewItem}
        existingItems={items}
        folders={folders}
        onCreateFolder={handleCreateFolder}
        isDark={isDark}
        initialType={captureInitialType}
        initialFolderId={selectedFolderId || undefined}
        initialContent={captureInitialContent}
        initialTitle={captureInitialTitle}
      />

      {/* Card Detail Modal */}
      <CardDetailModal
        item={detailItem}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailItem(null);
        }}
        onTogglePin={handleTogglePin}
        onDelete={handleDeleteItem}
        onUpdateItem={handleUpdateItem}
        onOpenImage={handleOpenImage}
        onOpenWholeView={handleOpenWholeView}
        folders={folders}
        onCreateFolder={handleCreateFolder}
        isDark={isDark}
      />

      {/* Whole View (Full Canvas / Page Reader & Editor for Skills & Markdown) */}
      <WholeViewModal
        item={wholeViewItem}
        isOpen={isWholeViewOpen}
        onClose={() => {
          setIsWholeViewOpen(false);
          setWholeViewItem(null);
        }}
        onTogglePin={handleTogglePin}
        onDelete={handleDeleteItem}
        onUpdateItem={handleUpdateItem}
        folders={folders}
        isDark={isDark}
      />

      {/* Lightbox Modal */}
      <ImageViewerModal
        isOpen={lightbox.isOpen}
        imageUrl={lightbox.imageUrl}
        title={lightbox.title}
        onClose={() => setLightbox({ isOpen: false, imageUrl: null, title: null })}
        isDark={isDark}
      />

    </div>
  );
}

export default App;
