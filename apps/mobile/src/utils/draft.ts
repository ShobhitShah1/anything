import type { SavedItem } from '../shared/types';
import { normalizeUrl } from '../shared/utils/fetchPreview.ts';
export type DraftKind =
  'auto' | 'note' | 'checklist' | 'link' | 'image' | 'markdown' | 'code' | 'secret';
export function draftItem(
  kind: Exclude<DraftKind, 'auto'>,
  text: string,
  title: string,
  existing: SavedItem | undefined,
  randomUUID: () => string,
): SavedItem {
  const content = text.trim();
  if (!content) throw new Error('Add something to keep before saving.');
  if (content.length > 12_000_000)
    throw new Error('This save is too large. Use a hosted image link instead.');
  const base = {
    id: existing?.id || randomUUID(),
    createdAt: existing?.createdAt || Date.now(),
    isPinned: existing?.isPinned || false,
    tags: existing?.tags || [],
    folderId: existing?.folderId,
    colorTint: existing?.colorTint,
    mediaAspectRatio: existing?.mediaAspectRatio,
    title:
      title.trim() ||
      (kind === 'secret'
        ? 'Secret'
        : kind === 'image'
          ? 'Image'
          : content.split('\n')[0].slice(0, 90)),
  };
  if (kind === 'link') {
    const url = normalizeUrl(content);
    return {
      ...base,
      type: 'link',
      url,
      domain: new URL(url).hostname.replace(/^www\./, ''),
      ...(existing?.type === 'link' && existing.url === url
        ? {
            description: existing.description,
            previewImage: existing.previewImage,
            favicon: existing.favicon,
          }
        : {}),
    };
  }
  if (kind === 'image') {
    if (!/^data:image\/(?:png|jpe?g|gif|webp|heic|heif);base64,/i.test(content))
      normalizeUrl(content);
    return {
      ...base,
      type: 'image',
      imageUrl: /^data:image\//i.test(content) ? content : normalizeUrl(content),
      caption: existing?.type === 'image' ? existing.caption : undefined,
      dimensions: existing?.type === 'image' ? existing.dimensions : undefined,
    };
  }
  if (kind === 'secret')
    return {
      ...base,
      type: 'secret',
      category: existing?.type === 'secret' ? existing.category : 'other',
      secretValue: content,
      username: existing?.type === 'secret' ? existing.username : undefined,
      notes: existing?.type === 'secret' ? existing.notes : undefined,
    };
  if (kind === 'code')
    return {
      ...base,
      type: 'code',
      code: content,
      language: existing?.type === 'code' ? existing.language : 'text',
      description: existing?.type === 'code' ? existing.description : undefined,
    };
  if (kind === 'markdown')
    return {
      ...base,
      type: 'markdown',
      content,
      isSkill: existing?.type === 'markdown' ? existing.isSkill : undefined,
    };
  if (kind === 'checklist')
    return {
      ...base,
      type: 'note',
      content: existing?.type === 'note' ? existing.content : '',
      checklist: content
        .split('\n')
        .filter((line) => line.trim())
        .map((line, index) => ({
          id:
            existing?.type === 'note'
              ? existing.checklist?.[index]?.id || randomUUID()
              : randomUUID(),
          text: line.trim().replace(/^[-*]\s*/, ''),
          completed:
            existing?.type === 'note' ? existing.checklist?.[index]?.completed || false : false,
        })),
    };
  return {
    ...base,
    type: 'note',
    content,
    typography: existing?.type === 'note' ? existing.typography : 'sans',
  };
}
