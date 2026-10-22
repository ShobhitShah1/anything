import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SavedItem, ViewMode, ItemType, Folder } from './types';
import { loadSavedItems, saveItemsToStorage, loadFolders, saveFolders } from './utils/storage';
import { fetchLinkPreview, applyLinkPreview } from './utils/fetchPreview';
import { sound } from './utils/sound';
import { Header } from './components/Header';
import { FloatingCaptureBar } from './components/FloatingCaptureBar';
import { FilterBar, FilterCategory, SortOption } from './components/FilterBar';
import { MasonryGrid } from './components/MasonryGrid';
import { ListView } from './components/ListView';
import { FocusCanvasView } from './components/FocusCanvasView';
import { CaptureSheet } from './components/CaptureSheet';
import { CardDetailModal } from './components/CardDetailModal';
import { WholeViewModal } from './components/WholeViewModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { CreativeEmptyView } from './components/CreativeEmptyView';
import { useCloudAccount } from './hooks/useCloudAccount';
import { readClipboardSafely, autoDetectClipboardContent } from './utils/clipboard';
import { createQuickCaptures } from './utils/quickCapture';
import { ClipboardCheck, AlertCircle } from 'lucide-react';

export function App() {
  const [items, setItemsState] = useState<SavedItem[]>(() => loadSavedItems());
  const itemsRef = useRef(items);
  const setItems = useCallback((update: React.SetStateAction<SavedItem[]>) => {
    const next = typeof update === 'function' ? update(itemsRef.current) : update;
    itemsRef.current = next;
    setItemsState(next);
  }, []);
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const account = useCloudAccount(items, folders, setItems, setFolders);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('masonry');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [autoClipboard, setAutoClipboard] = useState(() => {
    try { return localStorage.getItem('anything_auto_clipboard') === 'true'; } catch { return false; }
  });
  const [captureStatus, setCaptureStatus] = useState('');
  const lastClipboard = useRef('');
  const clipboardBusy = useRef(false);
  const previewQueue = useRef<{ id: string; url: string }[]>([]);
  const previewWorkers = useRef(0);

  useEffect(() => {
    if (!captureStatus) return;
    const timer = window.setTimeout(() => setCaptureStatus(''), 5000);
    return () => clearTimeout(timer);
  }, [captureStatus]);


  // Capture screen and item viewers
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

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
    try { localStorage.setItem('anything_theme', isDark ? 'dark' : 'light'); } catch { /* Theme still works without storage. */ }
  }, [isDark]);

  useEffect(() => {
    saveItemsToStorage(itemsRef.current);
  }, [items]);

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== 'anything_items_v2' || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        if (Array.isArray(next)) setItems(next);
      } catch { /* Keep the current collection if another tab writes invalid data. */ }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [setItems]);

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

  const handleDeleteAll = () => {
    if (!saveItemsToStorage([])) {
      setCaptureStatus('Could not delete saves. Your collection is unchanged.');
      return false;
    }
    setItems([]);
    previewQueue.current = [];
    setAutoClipboard(false);
    setDetailItem(null);
    setIsDetailOpen(false);
    setWholeViewItem(null);
    setIsWholeViewOpen(false);
    setLightbox({ isOpen: false, imageUrl: null, title: null });
    setCaptureStatus('All saves deleted. Clipboard auto-save paused.');
    return true;
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

  const handleSaveNewItem = (newItem: SavedItem, enrichPreview = false) => {
    setItems((prev) => [newItem, ...prev]);
    const url = 'url' in newItem ? newItem.url : 'postUrl' in newItem ? newItem.postUrl : undefined;
    if (url && enrichPreview) {
      void fetchLinkPreview(url).then(preview => {
        if (preview.error) return;
        setItems(previous => previous.map(item => item.id === newItem.id ? applyLinkPreview(item, preview) : item));
      }).catch(() => { /* The item is saved even if metadata fails. */ });
    }
  };

  const captureTexts = useCallback((texts: string[], linksOnly = false) => {
    try {
      const result = { items: [] as SavedItem[], duplicates: 0 };
      for (const text of texts) {
        const batch = createQuickCaptures(text, [...result.items, ...itemsRef.current], linksOnly, selectedFolderId || undefined);
        result.items.push(...batch.items);
        result.duplicates += batch.duplicates;
      }
      if (result.items.length) {
        const next = [...result.items, ...itemsRef.current];
        if (!saveItemsToStorage(next)) throw new Error('Browser storage is full. Export a backup and free some space before saving.');
        setItems(next);
        for (const item of result.items) {
          const url = 'url' in item ? item.url : 'postUrl' in item ? item.postUrl : undefined;
          if (url) previewQueue.current.push({ id: item.id, url });
        }
        const runWorker = async () => {
          previewWorkers.current++;
          try {
            while (previewQueue.current.length) {
              const entry = previewQueue.current.shift()!;
              try {
                const preview = await fetchLinkPreview(entry.url);
                if (preview.error) continue;
                const nextItems = itemsRef.current.map(item => item.id === entry.id ? applyLinkPreview(item, preview) : item);
                setItems(nextItems);
              } catch { /* The original capture is already saved. */ }
            }
          } finally { previewWorkers.current--; }
        };
        while (previewWorkers.current < 3 && previewQueue.current.length) void runWorker();
      }
      setCaptureStatus(result.items.length ? `Saved ${result.items.length}${result.duplicates ? ` · ${result.duplicates} already saved` : ''}` : 'Already in your collection');
      return true;
    } catch (error) {
      setCaptureStatus(error instanceof Error ? error.message : 'Could not save this capture.');
      return false;
    }
  }, [selectedFolderId, setItems]);

  const captureText = useCallback((text: string, linksOnly = false) => captureTexts([text], linksOnly), [captureTexts]);

  const handleQuickSave = (text: string) => {
    const saved = captureText(text, true);
    if (saved) { setSelectedFilter('all'); setSearchQuery(''); }
    return saved;
  };

  const handlePasteLinks = async () => {
    const result = await readClipboardSafely();
    if (result.status === 'ok' && result.text) handleQuickSave(result.text);
    else setCaptureStatus(result.status === 'permission_denied' ? 'Clipboard access was blocked. Paste into the link field instead.' : 'Copy a link first, then try again.');
  };

  const handleToggleAutoClipboard = async () => {
    if (autoClipboard) { setAutoClipboard(false); return; }
    const result = await readClipboardSafely();
    if (result.status === 'permission_denied' || result.status === 'unsupported') {
      setCaptureStatus('Allow clipboard access in your browser to enable auto-save.');
      return;
    }
    setAutoClipboard(true);
    setCaptureStatus('Auto-save on · checks while this page is focused');
    if (result.text) {
      if (captureText(result.text)) lastClipboard.current = result.text;
      else setAutoClipboard(false);
    }
  };

  useEffect(() => {
    try { localStorage.setItem('anything_auto_clipboard', String(autoClipboard)); } catch { /* Preference storage is optional. */ }
    if (!autoClipboard) return;
    let active = true;
    const check = async () => {
      if (clipboardBusy.current || document.visibilityState !== 'visible' || !document.hasFocus() || isCaptureOpen || isDetailOpen || isWholeViewOpen || lightbox.isOpen) return;
      clipboardBusy.current = true;
      try {
        const result = await readClipboardSafely();
        if (!active) return;
        if (result.status === 'permission_denied' || result.status === 'unsupported') {
          setAutoClipboard(false);
          setCaptureStatus('Clipboard auto-save paused. Allow access to turn it back on.');
        } else if (result.text && result.text !== lastClipboard.current) {
          if (captureText(result.text)) lastClipboard.current = result.text;
          else setAutoClipboard(false);
        }
      } finally { clipboardBusy.current = false; }
    };
    void check();
    const timer = window.setInterval(check, 1200);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [autoClipboard, captureText, isCaptureOpen, isDetailOpen, isWholeViewOpen, lightbox.isOpen]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'anything-extension' || !Array.isArray(event.data.entries) || event.data.entries.length > 100) return;
      const entries = event.data.entries.filter((entry: { id?: unknown; text?: unknown }) => typeof entry?.id === 'string' && entry.id.length <= 100 && typeof entry.text === 'string' && entry.text.trim() && entry.text.length <= 50_000);
      const ids = entries.length && captureTexts(entries.map((entry: { text: string }) => entry.text)) ? entries.map((entry: { id: string }) => entry.id) : [];
      window.postMessage({ source: 'anything-app', savedIds: ids }, location.origin);
    };
    window.addEventListener('message', receive);
    window.postMessage({ source: 'anything-app', ready: true }, location.origin);
    return () => window.removeEventListener('message', receive);
  }, [captureTexts]);

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
    const scopedItems = items.filter(i => selectedFolderId === null || i.folderId === selectedFolderId);
    const counts: Record<string, number> = {
      all: scopedItems.length,
      pinned: scopedItems.filter((i) => i.isPinned).length,
    };
    scopedItems.forEach((i) => {
      counts[i.type] = (counts[i.type] || 0) + 1;
    });
    return counts;
  }, [items, selectedFolderId]);

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
    <div id="top" className="anything-app min-h-screen flex flex-col">
      
      <div inert={isCaptureOpen} aria-hidden={isCaptureOpen} className={`collection-surface ${isCaptureOpen ? "capture-active" : ""}`}>
      {/* Top Header */}
      <Header
        account={account}
        items={items}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onImportItems={handleImportItems}
        onDeleteAll={handleDeleteAll}
        isDark={isDark}
        onReadClipboard={handleReadClipboard}
        autoClipboard={autoClipboard}
        onToggleAutoClipboard={handleToggleAutoClipboard}
        onToggleTheme={() => setIsDark(previous => !previous)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedFilter={selectedFilter}
        onNavigate={(filter) => {
          setSelectedFilter(filter);
          setSelectedFolderId(null);
          setSearchQuery('');
          setSelectedTag(null);
        }}
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
      {items.length > 0 && <FilterBar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        totalCount={items.length}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        itemCounts={itemCounts}
        folderCounts={Object.fromEntries(folders.map(folder => [folder.id, items.filter(item => item.folderId === folder.id).length]))}
        sortOption={sortOption}
        onSortChange={setSortOption}
        isDark={isDark}
      />}

      {/* Main Content Area */}
      <main className={`flex-1 w-full collection-main max-w-[1600px] mx-auto px-5 sm:px-9 pt-2 pb-10 ${items.length === 0 ? 'welcome-main' : ''}`}>
        
        {items.length === 0 ? (
          <CreativeEmptyView
            account={account}
            onOpenCapture={() => handleOpenCapture('note')}
            onDirectPaste={handleDirectPaste}
          />
        ) : (
          <>
              {/* Masonry View */}
              {viewMode === 'masonry' && (
                <>
                    {gridItems.length === 0 ? (
                      <div className="collection-no-results">
                        <span className="empty-orbit" aria-hidden="true">✳</span>
                        <h2>Nothing here. Yet.</h2>
                        <p>Try a different thought, or give this space something to remember.</p>
                        <button type="button" onClick={() => { setSearchQuery(''); setSelectedFilter('all'); setSelectedFolderId(null); setSelectedTag(null); }}>Show everything</button>
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
                </>
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
                onOpenDetail={handleOpenDetail}
                isDark={isDark}
              />
            )}
          </>
        )}

      </main>

      <FloatingCaptureBar hidden={isCaptureOpen || isDetailOpen || isWholeViewOpen || lightbox.isOpen} onOpenCapture={() => handleOpenCapture('note')} onQuickSave={handleQuickSave} onPasteLinks={handlePasteLinks} status={captureStatus} />
      </div>

      {/* Direct capture screen */}
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
