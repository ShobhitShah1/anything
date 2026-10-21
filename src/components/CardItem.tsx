import { getItemTitle } from '../utils/itemTitle';
import React, { useState } from 'react';
import { Pin, Trash2, Copy, Check, Heart, Repeat2, MessageSquare, ArrowUpRight, CheckSquare, Square, Code2, Maximize2, BookOpen, KeyRound, FileText, Link2, Image as ImageIcon, Folder as FolderIcon } from 'lucide-react';
import { SavedItem } from '../types';
import { sound } from '../utils/sound';
import { SecretReveal } from './SecretReveal';
import { MarkdownRenderer } from './MarkdownRenderer';
import confetti from 'canvas-confetti';

interface CardItemProps {
  item: SavedItem;
  folderName?: string;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: SavedItem) => void;
  onOpenImage?: (imageUrl: string, title: string) => void;
  onOpenDetail?: (item: SavedItem) => void;
  isDark?: boolean;
}

export const CardItem: React.FC<CardItemProps> = ({
  item,
  folderName,
  onTogglePin,
  onDelete,
  onUpdateItem,
  onOpenImage,
  onOpenDetail,
  isDark = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLinkOrContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = '';
    if ('postUrl' in item && item.postUrl) textToCopy = item.postUrl;
    else if ('url' in item && item.url) textToCopy = item.url;
    else if ('content' in item && item.content) textToCopy = item.content;
    else if ('code' in item && item.code) textToCopy = item.code;
    else if ('secretValue' in item && item.secretValue) textToCopy = item.secretValue;
    else textToCopy = item.title;

    navigator.clipboard.writeText(textToCopy);
    sound.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleToggleChecklist = (e: React.MouseEvent, checkId: string) => {
    e.stopPropagation();
    if (item.type !== 'note' || !item.checklist) return;
    const updatedChecklist = item.checklist.map((c) => {
      if (c.id === checkId) {
        const nextState = !c.completed;
        if (nextState) {
          sound.pop();
          const allOthersDone = item.checklist!.filter(x => x.id !== checkId).every(x => x.completed);
          if (allOthersDone) {
            confetti({ particleCount: 30, spread: 45, origin: { y: 0.7 } });
          }
        } else {
          sound.click();
        }
        return { ...c, completed: nextState };
      }
      return c;
    });

    onUpdateItem({
      ...item,
      checklist: updatedChecklist,
    });
  };

  const displayTitle = getItemTitle(item);
  const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(item.createdAt));
  const media = item.type === 'link' ? item.previewImage : 'imageUrl' in item ? item.imageUrl : undefined;
  const mediaAspectRatio = Number.isFinite(item.mediaAspectRatio) && item.mediaAspectRatio! > 0 ? item.mediaAspectRatio : item.type === 'link' ? 16 / 10 : 4 / 3;
  const labels = { note: 'Note', markdown: 'Markdown', link: 'Bookmark', image: 'Image', x_post: 'From X', reddit_post: 'From Reddit', instagram_post: 'From Instagram', code: 'Code', secret: 'Secret' };
  const Icon = item.type === 'note' ? FileText : item.type === 'markdown' ? BookOpen : item.type === 'code' ? Code2 : item.type === 'secret' ? KeyRound : media ? ImageIcon : Link2;

  return (
    <article className={`memory-card memory-${item.type}${media ? ' has-media' : ''}${item.isPinned ? ' is-pinned' : ''}`} tabIndex={0} aria-label={`Open ${displayTitle || labels[item.type]}${item.isPinned ? ', pinned' : ''}`} onClick={() => onOpenDetail?.(item)} onKeyDown={event => {
      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenDetail?.(item); }
    }}>
      <div className="memory-actions" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => onOpenDetail?.(item)} title="Open save" aria-label="Open save"><Maximize2 /></button>
        <button type="button" onClick={() => { sound.pin(); onTogglePin(item.id); }} title={item.isPinned ? 'Unpin' : 'Pin to top'} aria-label={item.isPinned ? 'Unpin' : 'Pin to top'} aria-pressed={item.isPinned}><Pin className={item.isPinned ? 'fill-current' : ''} /></button>
        <button type="button" onClick={handleCopyLinkOrContent} title="Copy content or link" aria-label="Copy content or link">{copied ? <Check /> : <Copy />}</button>
        <button type="button" onClick={() => { sound.delete(); onDelete(item.id); }} title="Delete item" aria-label="Delete item"><Trash2 /></button>
      </div>
      {item.isPinned && <div className="memory-pin-label"><Pin aria-hidden="true" />Pinned</div>}
      {item.type === 'x_post' && <div className="memory-post-header">
        <div className="memory-author">{item.authorAvatar ? <img src={item.authorAvatar} alt="" /> : <span className="memory-avatar">{(item.authorName || 'X').slice(0, 1)}</span>}<div><strong>{item.authorName || 'Creator'}</strong><span>@{(item.authorHandle || 'creator').replace(/^@/, '')}</span></div></div>
        <a className="memory-platform" href={item.postUrl} target="_blank" rel="noopener noreferrer" aria-label="Open original post on X" title="Open original post on X" onClick={event => event.stopPropagation()}>𝕏<ArrowUpRight className="memory-platform-arrow" /></a>
      </div>}
      {media && (
        <button type="button" className="memory-media" style={{ aspectRatio: mediaAspectRatio }} aria-label={`View image: ${item.title}`} onClick={event => { event.stopPropagation(); onOpenImage?.(media, item.title); }}>
          <img src={media} alt={item.title} loading="lazy" decoding="async" onLoad={event => {
            const image = event.currentTarget;
            const ratio = image.naturalWidth / image.naturalHeight;
            if (Number.isFinite(ratio) && ratio > 0 && ratio !== item.mediaAspectRatio) onUpdateItem({ ...item, mediaAspectRatio: ratio });
          }} onError={event => { event.currentTarget.parentElement!.style.display = 'none'; }} />
        </button>
      )}
      <div className="memory-body">
        {item.type !== 'x_post' && <div className="memory-kicker"><Icon /><span>{item.type === 'code' ? item.language : labels[item.type]}</span></div>}
        {item.title && item.type !== 'x_post' && !(item.type === 'note' && item.title === 'Note') && <h2>{displayTitle}</h2>}
        {item.type === 'note' && <>
          {item.content && <p className={`memory-note-text ${item.typography === 'mono' ? 'font-mono' : ''}`}>{item.content}</p>}
          {item.checklist && item.checklist.length > 0 && <div className="memory-checklist">{item.checklist.map(check => (
            <button type="button" key={check.id} aria-pressed={check.completed} onClick={event => handleToggleChecklist(event, check.id)}>
              {check.completed ? <CheckSquare /> : <Square />}<span className={check.completed ? 'is-completed' : ''}>{check.text}</span>
            </button>
          ))}</div>}
        </>}
        {item.type === 'link' && <>
          {item.description && <p className="memory-description">{item.description}</p>}
        </>}
        {item.type === 'x_post' && <>
          {item.content && <p className="memory-note-text">{item.content}</p>}
        </>}
        {item.type === 'reddit_post' && <>
          <div className="memory-author"><strong>{item.subreddit}</strong><span>{item.author}</span></div>
          <p className="memory-description">{item.content}</p>
          <div className="memory-social">{item.upvotes !== undefined && <span>↑ {item.upvotes.toLocaleString()}</span>}{item.commentsCount !== undefined && <span><MessageSquare />{item.commentsCount}</span>}</div>
        </>}
        {item.type === 'instagram_post' && <><div className="memory-author"><strong>@{item.handle.replace(/^@/, '')}</strong>{item.likes !== undefined && <span><Heart size={12} />{item.likes.toLocaleString()}</span>}</div>{item.caption && <p className="memory-description">{item.caption}</p>}</>}
        {item.type === 'image' && item.caption && <p className="memory-description">{item.caption}</p>}
        {item.type === 'markdown' && <div className="memory-markdown"><MarkdownRenderer content={(item.content || '').slice(0, 600)} isDark={isDark} /></div>}
        {item.type === 'code' && <><pre className="memory-code"><code>{item.code}</code></pre>{item.description && <p className="memory-description">{item.description}</p>}</>}
        {item.type === 'secret' && <div onClick={event => event.stopPropagation()}><SecretReveal item={item} /></div>}
        {item.type === 'x_post' ? <footer className="memory-footer memory-post-footer">
          <div className="memory-social">{item.likes !== undefined && <span aria-label={`${item.likes.toLocaleString()} likes`}><Heart />{item.likes.toLocaleString()}</span>}{item.reposts !== undefined && <span aria-label={`${item.reposts.toLocaleString()} reposts`}><Repeat2 />{item.reposts.toLocaleString()}</span>}</div>
          <time dateTime={new Date(item.createdAt).toISOString()}>{formattedDate}</time>
        </footer> : <footer className="memory-footer">
          {item.type === 'link' ? <a className="memory-source" href={item.url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{item.favicon ? <img src={item.favicon} alt="" /> : <Link2 />}<span>{item.domain || item.url}</span><ArrowUpRight /></a> : <span>{folderName ? <><FolderIcon />{folderName}</> : item.tags?.[0] ? `#${item.tags[0]}` : formattedDate}</span>}
          {item.type === 'link' && folderName ? <span className="memory-folder" title={folderName}><FolderIcon />{folderName}</span> : <time dateTime={new Date(item.createdAt).toISOString()}>{item.type === 'link' || folderName || item.tags?.[0] ? formattedDate : ''}</time>}
        </footer>}
      </div>
    </article>
  );
};
