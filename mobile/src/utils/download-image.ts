import { Directory, File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

export async function downloadImage(uri: string): Promise<boolean> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (/cancel|dismiss/i.test(String((error as Error)?.message))) return false;
    throw error;
  }

  const embedded = uri.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/);
  let mime: string;
  let contents: string | Uint8Array;
  if (embedded) {
    mime = embedded[1];
    contents = embedded[2];
  } else if (/^https?:\/\//i.test(uri)) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not download this image. Please try again.');
    mime = response.headers.get('content-type')?.split(';')[0].trim() || '';
    contents = await response.bytes();
  } else {
    const file = new File(uri);
    mime = file.type;
    contents = await file.bytes();
  }
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
  };
  const extension = extensions[mime];
  if (!extension) throw new Error('This image format cannot be downloaded.');
  const output = directory.createFile(`Anything-${Date.now()}.${extension}`, mime);
  try {
    await output.write(contents, typeof contents === 'string' ? { encoding: 'base64' } : undefined);
  } catch (error) {
    // Remove a partial export without touching the original image.
    try {
      output.delete();
    } catch {
      /* Preserve the write error. */
    }
    throw error;
  }
  return true;
}
