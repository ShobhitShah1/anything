import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { sound } from '../utils/sound';

interface ImageViewerModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  title: string | null;
  onClose: () => void;
  isDark?: boolean;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  imageUrl,
  title,
  onClose,
  isDark = true,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(imageUrl);
    sound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <AnimatePresence>
      <dialog ref={dialogRef} aria-label={title || 'Image preview'} onCancel={event => { event.preventDefault(); onClose(); }} className="memory-dialog fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            sound.click();
            onClose();
          }}
          className={`absolute inset-0 ${isDark ? 'bg-black/80' : 'bg-white/90'} backdrop-blur-md`}
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center z-10"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between pb-3 px-2 text-xs font-mono text-zinc-500">
            <span className={`truncate max-w-md font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
              {title || 'Image Preview'}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyLink}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:text-black'
                }`}
                title="Copy Image URL"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>

              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:text-black'
                }`}
                title="Open original"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={() => {
                  sound.click();
                  onClose();
                }}
                className={`p-2 rounded-xl transition-all ml-1 cursor-pointer ${
                  isDark ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-black'
                }`}
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image Frame */}
          <div className={`rounded-2xl overflow-hidden border shadow-2xl max-h-[80vh] flex items-center justify-center p-2 transition-colors ${
            isDark ? 'bg-[#18181B] border-zinc-800' : 'bg-white border-zinc-200/90'
          }`}>
            <img
              src={imageUrl}
              alt={title || 'Preview'}
              className="max-h-[76vh] max-w-full w-auto object-contain rounded-xl select-none"
            />
          </div>
        </motion.div>
      </dialog>
    </AnimatePresence>
  );
};
