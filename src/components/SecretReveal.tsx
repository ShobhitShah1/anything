import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check, KeyRound, Wifi, Terminal } from 'lucide-react';
import { sound } from '../utils/sound';
import { SecretItem } from '../types';

interface SecretRevealProps {
  item: SecretItem;
}

export const SecretReveal: React.FC<SecretRevealProps> = ({ item }) => {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.secretValue);
    sound.save();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'wifi':
        return <Wifi className="w-3.5 h-3.5 text-zinc-500" />;
      case 'api_key':
        return <Terminal className="w-3.5 h-3.5 text-zinc-500" />;
      case 'password':
      default:
        return <KeyRound className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  const calculateStrength = (val: string) => {
    let score = 0;
    if (val.length > 8) score++;
    if (val.length > 14) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;
    return Math.max(1, Math.min(score, 4));
  };

  const strength = calculateStrength(item.secretValue);

  return (
    <div className="space-y-3 pt-1">
      {/* Category and user info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
          {getCategoryIcon()}
          <span className="capitalize">{item.category.replace('_', ' ')}</span>
        </div>
        {item.username && (
          <span className="font-mono text-zinc-500 dark:text-zinc-400 text-[11px] truncate max-w-[140px]">
            {item.username}
          </span>
        )}
      </div>

      {/* Secret Display Box */}
      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-2 select-all group">
        <div className="overflow-hidden truncate tracking-wider font-semibold">
          {revealed ? item.secretValue : '•'.repeat(Math.min(item.secretValue.length, 18))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.click();
              setRevealed(!revealed);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={revealed ? 'Hide secret' : 'Reveal secret'}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              copied
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
            }`}
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Security Strength Indicator */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1 flex-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                level <= strength ? 'bg-zinc-800 dark:bg-zinc-300' : 'bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
          {strength >= 4 ? 'strong' : strength >= 3 ? 'good' : 'fair'}
        </span>
      </div>

      {/* Optional Note */}
      {item.notes && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
          {item.notes}
        </p>
      )}
    </div>
  );
};
