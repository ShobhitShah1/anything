import React from 'react';
import { ArrowUpRight, Clipboard, Plus, Monitor } from 'lucide-react';
import { CURATED_STARTER_ITEMS } from '../utils/starterItems';
import { SavedItem } from '../types';
import { BrandMark } from './BrandMark';
import { GoogleSignInButton } from './AccountMenu';
import type { CloudAccount } from '../hooks/useCloudAccount';

interface CreativeEmptyViewProps {
  account: CloudAccount;
  onOpenCapture: () => void;
  onDirectPaste: () => void;
  onLoadStarters: (items: SavedItem[]) => void;
  isDark?: boolean;
}

export const CreativeEmptyView: React.FC<CreativeEmptyViewProps> = ({ account, onOpenCapture, onDirectPaste, onLoadStarters }) => (
  <section className="mind-empty">
    <div className="mind-empty-art" aria-hidden="true"><BrandMark /></div>
    <h1>Good finds.<br /><em>One place.</em></h1>
    <p className="welcome-description">Keep what catches your eye.</p>
    <div className="mind-empty-actions">
      {!account.user && <GoogleSignInButton onClick={() => void account.signIn()} disabled={account.busy || account.loading} />}
      {account.user ? <>
      <button type="button" className="mind-save-button" onClick={onOpenCapture}><Plus />Create a memory</button>
      <button type="button" className="mind-text-button" onClick={onDirectPaste}><Clipboard />Paste a link</button>
      </> : <button type="button" className="welcome-local" onClick={onOpenCapture}><Monitor aria-hidden="true" /><span>Continue on this device</span><ArrowUpRight aria-hidden="true" /></button>}
    </div>
    {account.error && <p className="account-error" role="alert">{account.error}</p>}
    <footer className="welcome-secondary">
      <button type="button" className="mind-starters" onClick={() => onLoadStarters(CURATED_STARTER_ITEMS)}>Explore examples <ArrowUpRight /></button>
      <a href="https://x.com/Shobhit940" target="_blank" rel="noopener noreferrer">By Shobhit<ArrowUpRight aria-hidden="true" /></a>
    </footer>
  </section>
);
