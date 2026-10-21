import React, { useId } from 'react';
import { Volume2, VolumeX, Download, Upload, LayoutGrid, List, Maximize2, Clipboard, Search, X, Settings2, Pin, Folder, Sun, Moon, Trash2, ArrowUpRight, Plus } from 'lucide-react';
import { ViewMode, SavedItem } from '../types';
import type { FilterCategory } from './FilterBar';
import { sound } from '../utils/sound';
import { exportItemsToJson } from '../utils/storage';
import { BrandMark } from './BrandMark';
import { AccountMenu } from './AccountMenu';
import type { CloudAccount } from '../hooks/useCloudAccount';

interface HeaderProps {
  account: CloudAccount;
  items: SavedItem[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onImportItems: (items: SavedItem[]) => void;
  onDeleteAll: () => boolean;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onReadClipboard: () => void;
  autoClipboard: boolean;
  onToggleAutoClipboard: () => Promise<void>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFilter: FilterCategory;
  onNavigate: (filter: FilterCategory) => void;
}

export const Header: React.FC<HeaderProps> = ({
  account, items, viewMode, onViewModeChange, onImportItems, onDeleteAll, onReadClipboard, autoClipboard, onToggleAutoClipboard, searchQuery, onSearchChange, selectedFilter, onNavigate, isDark, onToggleTheme,
}) => {
  const [soundOn, setSoundOn] = React.useState(sound.enabled);
  const [connecting, setConnecting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const menuId = useId();
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
    <>
      <nav className="mind-rail" aria-label="Main navigation">
        <a href="#top" onClick={() => { onNavigate('all'); onViewModeChange('masonry'); }} aria-label="Anything home" className="mind-mark" title="Anything"><BrandMark /></a>
        {items.length > 0 && <div className="mind-rail-links">
          <button type="button" aria-label="Everything" title="Everything" aria-pressed={selectedFilter === 'all' && viewMode !== 'focus'} onClick={() => { onNavigate('all'); onViewModeChange('masonry'); }}><LayoutGrid /></button>
          <button type="button" aria-label="Pinned saves" title="Pinned saves" aria-pressed={selectedFilter === 'pinned'} onClick={() => { onNavigate('pinned'); onViewModeChange('masonry'); }}><Pin /></button>
          <button type="button" aria-label="Browse folders" title="Browse folders" onClick={() => document.querySelector<HTMLButtonElement>('.collection-folder button')?.click()}><Folder /></button>
          <button type="button" aria-label="Focus mode" title="Focus mode" aria-pressed={viewMode === 'focus'} onClick={() => onViewModeChange('focus')}><Maximize2 /></button>
        </div>}
        <div className="mind-rail-bottom">
          <button type="button" onClick={onReadClipboard} aria-label="Inspect clipboard" title="Inspect clipboard"><Clipboard /></button>
          <button type="button" popoverTarget={menuId} aria-label="More options" title="Settings"><Settings2 /></button>
          <button type="button" onClick={onToggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>{isDark ? <Sun /> : <Moon />}</button>
        </div>
      </nav>
      <header className={`mind-header ${items.length === 0 ? 'welcome-header' : ''}`}>
        <div className="mind-header-inner">
          {items.length === 0 ? <span className="welcome-wordmark">Anything<span>.</span></span> : <div className="mind-search">
            <Search aria-hidden="true" />
            <input aria-label="Search saves" type="search" value={searchQuery} onChange={event => onSearchChange(event.target.value)} placeholder="Search your mind..." />
            {searchQuery && <button type="button" aria-label="Clear search" onClick={() => onSearchChange('')}><X /></button>}
            {!searchQuery && <kbd aria-hidden="true">/</kbd>}
          </div>}
          <div className="mind-header-actions">
            {items.length > 0 && <><span className="mind-save-count">{items.length} {items.length === 1 ? 'memory' : 'memories'}</span>
            <div className="mind-view-toggle" aria-label="View layout">
              {([['masonry', 'Grid', LayoutGrid], ['list', 'List', List]] as const).map(([mode, label, Icon]) => (
                <button key={mode} type="button" aria-label={label} aria-pressed={viewMode === mode} title={label} onClick={() => onViewModeChange(mode)}><Icon /></button>
              ))}
            </div></>}
            <AccountMenu account={account} />
          </div>
        </div>
        <div id={menuId} popover="auto" className="mind-options" onToggle={event => { if (event.newState === 'closed') setConfirmDelete(false); }}>
          <div className="settings-heading"><div><h2>Settings</h2><p>Make this space yours.</p></div><button type="button" popoverTarget={menuId} popoverTargetAction="hide" aria-label="Close settings"><X /></button></div>
          <section className="settings-section" aria-label="Preferences">
            <h3>Preferences</h3>
            <button type="button" className="settings-row" onClick={onToggleTheme}>{isDark ? <Moon /> : <Sun />}<span className="settings-copy"><strong>Appearance</strong><small>{isDark ? 'Matte black' : 'Light'}</small></span><span className="settings-value">Switch to {isDark ? 'light' : 'dark'}</span></button>
            <label className="settings-row settings-clipboard">{soundOn ? <Volume2 /> : <VolumeX />}<span className="settings-copy"><strong>Interface sounds</strong><small>Quiet feedback for your actions</small></span><input aria-label="Interface sounds" type="checkbox" role="switch" checked={soundOn} onChange={() => setSoundOn(sound.toggle())} /></label>
          </section>
          <section className="settings-section" aria-label="Capture">
            <h3>Capture</h3>
            <label className="settings-row settings-clipboard"><Clipboard /><span className="settings-copy"><strong>Auto-save clipboard</strong><small>{connecting ? 'Allow clipboard access…' : 'Save new text while Anything is focused'}</small></span><input aria-label="Auto-save clipboard" type="checkbox" role="switch" checked={autoClipboard} disabled={connecting} onChange={async () => { setConnecting(true); try { await onToggleAutoClipboard(); } finally { setConnecting(false); } }} /></label>
            <details className="extension-setup">
              <summary><span>Browser extension<small>Save pages, links, and text from other sites</small></span><ArrowUpRight aria-hidden="true" /></summary>
              <div className="extension-instructions">
                <p>Right-click to save from Chrome or Edge. Optionally save text you copy on websites.</p>
                <a href={`${import.meta.env.BASE_URL}anything-extension.zip`} download><Download aria-hidden="true" />Download browser extension</a>
                <ol><li>Extract the ZIP into a folder you can keep.</li><li>Open your browser’s Extensions page, enable Developer mode, and choose Load unpacked.</li><li>Select the extracted folder, then open the extension and connect it to the address below.</li></ol>
                <label htmlFor={`${menuId}-address`}>Your Anything address</label>
                <input id={`${menuId}-address`} aria-label="Your Anything address" readOnly value={`${location.origin}${import.meta.env.BASE_URL}`} />
              </div>
            </details>
          </section>
          <section className="settings-section" aria-label="Your collection">
            <h3>Your collection<span>{items.length} {items.length === 1 ? 'save' : 'saves'}</span></h3>
            <button type="button" className="settings-row" disabled={!items.length} onClick={() => exportItemsToJson(items)}><Download /><span className="settings-copy"><strong>Export saves</strong><small>Download a JSON backup</small></span><ArrowUpRight /></button>
            <label className="settings-row"><Upload /><span className="settings-copy"><strong>Import saves</strong><small>Add saves from a JSON backup</small></span><Plus /><input aria-label="Import saves" type="file" accept=".json" onChange={handleFileUpload} /></label>
            <p className="settings-local-note">Stored in this browser. Export a backup to keep a copy.</p>
          </section>
          {items.length > 0 && <div className="settings-delete">
            <h3>Manage saves</h3>
            {confirmDelete ? <>
              <p>Delete all {items.length} saves, including pinned saves and saves in every folder? This cannot be undone. {account.enabled && 'Cloud sync is on, so these deletions will also sync to your account. '}Export a backup first if you want to keep them.</p>
              <button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="danger-action" onClick={() => { if (onDeleteAll()) setConfirmDelete(false); }}><Trash2 />Yes, delete all {items.length} saves</button>
            </> : <button type="button" className="danger-action" onClick={() => setConfirmDelete(true)}><Trash2 />Delete all saves…</button>}
          </div>}
        </div>
      </header>
    </>
  );
};
