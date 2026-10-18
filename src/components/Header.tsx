import React from 'react';
import { 
  Volume2, 
  VolumeX, 
  Download, 
  Upload, 
  LayoutGrid, 
  List, 
  Maximize2, 
  Plus,
  Clipboard
} from 'lucide-react';
import { ViewMode, SavedItem } from '../types';
import { sound } from '../utils/sound';
import { exportItemsToJson } from '../utils/storage';

interface HeaderProps {
  items: SavedItem[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenCapture: () => void;
  onImportItems: (items: SavedItem[]) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onReadClipboard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  items,
  viewMode,
  onViewModeChange,
  onOpenCapture,
  onImportItems,
  isDark = true,
  onReadClipboard,
}) => {
  const [soundOn, setSoundOn] = React.useState(sound.enabled);

  const handleToggleSound = () => {
    const next = sound.toggle();
    setSoundOn(next);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportItems(parsed);
          sound.save();
        }
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="w-full py-4 px-4 sm:px-8 sticky top-0 z-30 transition-all glass-header-dark">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        
        {/* Pure Typographic Wordmark (Zero Clutter) */}
        <div className="flex items-center gap-3">
          <a 
            href="#top" 
            onClick={(e) => { e.preventDefault(); sound.click(); }}
            className="text-xl font-bold tracking-tight text-white hover:opacity-90 transition-opacity cursor-pointer flex items-center select-none"
          >
            <span className="tracking-tight font-sans font-bold text-xl text-white">
              Anything<span className="text-zinc-500">.</span>
            </span>
          </a>
          {items.length > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-400">
              {items.length}
            </span>
          )}
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-lg border bg-zinc-900 border-zinc-800">
            <button
              onClick={() => {
                sound.click();
                onViewModeChange('masonry');
              }}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === 'masonry'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              title="Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                sound.click();
                onViewModeChange('list');
              }}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              title="List"
            >
              <List className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                sound.click();
                onViewModeChange('focus');
              }}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === 'focus'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              title="Focus"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clipboard Quick Inspect Button */}
          <button
            onClick={onReadClipboard}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Inspect clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title={soundOn ? 'Mute audio' : 'Enable audio'}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Export / Import */}
          {items.length > 0 && (
            <button
              onClick={() => {
                sound.click();
                exportItemsToJson(items);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Export"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <label 
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Import"
          >
            <Upload className="w-3.5 h-3.5" />
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </label>

          {/* Save Button */}
          <button
            onClick={() => {
              sound.pop();
              onOpenCapture();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-all active:scale-95 shadow-xs cursor-pointer ${
              isDark 
                ? 'bg-white text-zinc-950 hover:bg-zinc-200' 
                : 'bg-zinc-900 text-white hover:bg-black'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Save</span>
            <kbd className={`hidden sm:inline-block px-1 rounded text-[9px] font-mono ${
              isDark ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-800 text-zinc-300'
            }`}>
              ⌘K
            </kbd>
          </button>

        </div>
      </div>
    </header>
  );
};
