import { useState } from 'react';
import { Plus, ArrowUp, Clipboard } from 'lucide-react';

interface FloatingCaptureBarProps {
  onOpenCapture: () => void;
  onQuickSave: (text: string) => boolean;
  onPasteLinks: () => void;
  status: string;
  hidden: boolean;
}

export const FloatingCaptureBar = ({ onOpenCapture, onQuickSave, onPasteLinks, status, hidden }: FloatingCaptureBarProps) => {
  const [link, setLink] = useState('');
  return (
    <section data-capture-source="capture" className={`capture-dock${link.trim() ? ' has-link' : ''}`} hidden={hidden} aria-label="Quick capture">
      <button type="button" className="floating-save" onClick={onOpenCapture} aria-label="Save something">
        <span className="save-icon" aria-hidden="true"><Plus /></span>
        <span className="save-label">Save</span>
        <kbd className="save-key" aria-hidden="true">N</kbd>
      </button>
      <span className="dock-seam" aria-hidden="true" />
      <form className="quick-link-form" onSubmit={event => { event.preventDefault(); if (!link.trim()) { onPasteLinks(); } else if (onQuickSave(link)) { setLink(''); } }}>
        <span className="dock-format-label" aria-hidden="true">LINK</span>
        <input aria-label="Quick add links" placeholder="Paste a link…" value={link} maxLength={50_000} onChange={event => setLink(event.target.value)} onPaste={event => { const text = event.clipboardData.getData('text/plain'); if (text) { event.preventDefault(); setLink(text.replace(/\s+/g, ' ')); } }} />
        <button type="submit" aria-label={link.trim() ? 'Add links' : 'Save all copied links'} title={link.trim() ? 'Add links' : 'Save all copied links'}>{link.trim() ? <ArrowUp /> : <Clipboard />}</button>
      </form>
      {status && <p className="quick-capture-status" role="status">{status}</p>}
    </section>
  );
};
