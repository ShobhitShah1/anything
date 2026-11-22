import type { ShareIntent, ShareIntentFile } from 'expo-share-intent';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { SavedItem } from '../shared/types';
import { createQuickCaptures } from '../shared/utils/quickCapture.ts';
import { draftItem } from '../utils/draft.ts';
import { hasSupportedCodeExtension, languageFromPath } from '../utils/code-format.ts';
import { findDuplicateItem } from '../shared/utils/clipboard.ts';

export interface ShareIntentStorageContext {
  items: SavedItem[];
  save: (item: SavedItem) => Promise<void>;
  capture: (text: string, linksOnly?: boolean, folderId?: string, quiet?: boolean) => Promise<void>;
  enrich: (items: SavedItem[]) => void;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
}

export interface ProcessShareIntentResult {
  success: boolean;
  savedId?: string;
}

export function isImageFile(file: ShareIntentFile): boolean {
  if (file.mimeType?.toLowerCase().startsWith('image/')) return true;
  const name = (file.fileName || file.path || '').toLowerCase();

  return /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/i.test(name);
}

export function mimeFromFileNameOrType(file: ShareIntentFile): string {
  if (file.mimeType?.startsWith('image/')) return file.mimeType.toLowerCase();
  const ext = (file.fileName || file.path || '').split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';

  return 'image/jpeg';
}

export async function readFileAsBase64(
  filePath: string,
  reader: typeof readAsStringAsync = readAsStringAsync,
): Promise<string> {
  try {
    return await reader(filePath, { encoding: EncodingType.Base64 });
  } catch (err1) {
    if (!filePath.startsWith('file://') && !filePath.startsWith('content://')) {
      return await reader(`file://${filePath}`, { encoding: EncodingType.Base64 });
    }
    throw err1;
  }
}

export async function readFileAsText(
  filePath: string,
  reader: typeof readAsStringAsync = readAsStringAsync,
): Promise<string> {
  try {
    return await reader(filePath, { encoding: EncodingType.UTF8 });
  } catch (err1) {
    if (!filePath.startsWith('file://') && !filePath.startsWith('content://')) {
      return await reader(`file://${filePath}`, { encoding: EncodingType.UTF8 });
    }
    throw err1;
  }
}

export async function processShareIntent(
  shareIntent: ShareIntent,
  context: ShareIntentStorageContext,
  options: {
    uuidGenerator?: () => string;
    fileReader?: typeof readAsStringAsync;
    triggerHaptics?: boolean;
  } = {},
): Promise<ProcessShareIntentResult> {
  const uuid = options.uuidGenerator || randomUUID;
  const fileReader = options.fileReader || readAsStringAsync;
  const triggerHaptics = options.triggerHaptics !== false;

  const notifySuccess = (message: string) => {
    if (triggerHaptics) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    context.setNotice(message);
  };

  // 1. Files handling (images, code files, text documents)
  if (shareIntent.files && shareIntent.files.length > 0) {
    const validFiles = shareIntent.files.filter((f) => Boolean(f.path || f.fileName));
    const imageFiles = validFiles.filter(isImageFile);
    const nonImageFiles = validFiles.filter((f) => !isImageFile(f));

    let savedAny = false;
    let savedId: string | undefined;

    // Handle image files
    if (imageFiles.length > 0) {
      const readImages = await Promise.all(
        imageFiles.map(async (file) => {
          const path = file.path;
          const base64 = await readFileAsBase64(path, fileReader);
          const mime = mimeFromFileNameOrType(file);
          const uri = `data:${mime};base64,${base64}`;
          const ratio =
            file.width && file.height && file.width > 0 && file.height > 0
              ? file.width / file.height
              : undefined;

          return { uri, ratio, fileName: file.fileName };
        }),
      );

      const [cover, ...additional] = readImages;
      const title =
        shareIntent.meta?.title?.trim() ||
        cover.fileName?.replace(/\.[^.]+$/, '') ||
        'Shared image';

      const baseItem = draftItem('image', cover.uri, title, undefined, uuid);
      if (baseItem.type !== 'image') throw new Error('Could not prepare these images.');
      const imageItem: SavedItem = {
        ...baseItem,
        caption: shareIntent.text?.trim() || undefined,
        mediaAspectRatio: cover.ratio,
        additionalImages: additional.length
          ? additional.map((img) => ({ url: img.uri, aspectRatio: img.ratio }))
          : undefined,
      };

      await context.save(imageItem);
      savedAny = true;
      if (!savedId) savedId = imageItem.id;
      notifySuccess(
        readImages.length > 1
          ? `Saved ${readImages.length} images`
          : 'Saved image to your collection',
      );
    }

    // Handle non-image files (documents, code, markdown)
    for (const file of nonImageFiles) {
      const path = file.path;
      const textContent = await readFileAsText(path, fileReader);
      const filename = file.fileName || path.split('/').pop() || 'document.txt';

      if (filename.toLowerCase().endsWith('.md')) {
        const item: SavedItem = {
          id: uuid(),
          type: 'markdown',
          title:
            shareIntent.meta?.title?.trim() || filename.replace(/\.md$/i, '') || 'Markdown note',
          content: textContent,
          createdAt: Date.now(),
          isPinned: false,
          tags: [],
        };
        await context.save(item);
        savedAny = true;
        if (!savedId) savedId = item.id;
        notifySuccess(`Saved ${filename} to your collection`);
      } else if (hasSupportedCodeExtension(filename)) {
        const lang = languageFromPath(filename);
        const item: SavedItem = {
          id: uuid(),
          type: 'code',
          title: shareIntent.meta?.title?.trim() || filename,
          code: textContent,
          language: lang,
          files: [{ path: filename, code: textContent, language: lang }],
          createdAt: Date.now(),
          isPinned: false,
          tags: [],
        };
        await context.save(item);
        savedAny = true;
        if (!savedId) savedId = item.id;
        notifySuccess(`Saved ${filename} to your collection`);
      } else {
        const result = createQuickCaptures(textContent, context.items);
        if (result.items.length > 0) {
          for (const item of result.items) {
            await context.save(item);
          }
          savedAny = true;
          if (!savedId) savedId = result.items[0].id;
          notifySuccess(
            result.items.length > 1
              ? `Saved ${result.items.length} finds`
              : `Saved ${filename} to your collection`,
          );
        } else if (result.duplicates > 0) {
          context.setNotice('Already in your collection');
          const duplicate = findDuplicateItem(textContent, context.items);
          if (!savedId && duplicate) savedId = duplicate.id;
        }
      }
    }

    if (savedAny) {
      return { success: true, savedId };
    }
  }

  // 2. Web URL or Text payload
  const rawText = (shareIntent.webUrl || shareIntent.text || '').trim();
  if (!rawText) return { success: false };

  const result = createQuickCaptures(rawText, context.items);

  if (result.items.length > 0) {
    let savedId: string | undefined;
    for (const item of result.items) {
      let toSave = item;
      if (shareIntent.meta?.title?.trim()) {
        const customTitle = shareIntent.meta.title.trim();
        if (
          !item.title ||
          item.title === 'Link' ||
          item.title === 'X post' ||
          item.title === 'Reddit post' ||
          item.title === 'Instagram post' ||
          item.title.startsWith('http') ||
          ('domain' in item && item.title === item.domain)
        ) {
          toSave = { ...item, title: customTitle };
        }
      }
      await context.save(toSave);
      if (!savedId) savedId = toSave.id;
    }
    notifySuccess(
      result.items.length > 1 ? `Saved ${result.items.length} finds` : 'Saved to your collection',
    );

    return { success: true, savedId };
  }

  if (result.duplicates > 0) {
    context.setNotice('Already in your collection');
    const duplicate = findDuplicateItem(rawText, context.items);

    return { success: true, savedId: duplicate?.id };
  }

  return { success: false };
}
