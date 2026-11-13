import type { SavedItem } from '../shared/types';
export function itemText(item: SavedItem) {
  switch (item.type) {
    case 'code':
      return item.code;
    case 'secret':
      return item.secretValue;
    case 'credential':
      return '';
    case 'image':
      return item.caption || '';
    case 'link':
      return item.description || '';
    case 'instagram_post':
      return item.caption;
    default:
      return item.content;
  }
}
export function itemUrl(item: SavedItem) {
  return 'url' in item
    ? item.url
    : 'postUrl' in item
      ? item.postUrl
      : item.type === 'image' && /^https?:/.test(item.imageUrl)
        ? item.imageUrl
        : undefined;
}

export function linkPlatform(value: string) {
  let hostname: string;

  try {
    hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }

  const platforms: Record<string, string> = {
    'x.com': 'X',
    'twitter.com': 'X',
    'instagram.com': 'Instagram',
    'reddit.com': 'Reddit',
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'tiktok.com': 'TikTok',
    'facebook.com': 'Facebook',
    'threads.net': 'Threads',
    'linkedin.com': 'LinkedIn',
    'pinterest.com': 'Pinterest',
    'twitch.tv': 'Twitch',
    'spotify.com': 'Spotify',
  };

  return Object.entries(platforms).find(
    ([domain]) => hostname === domain || hostname.endsWith(`.${domain}`),
  )?.[1];
}

export function itemImage(item: SavedItem) {
  return 'imageUrl' in item ? item.imageUrl : item.type === 'link' ? item.previewImage : undefined;
}
export function imageSet(item: SavedItem) {
  return item.type === 'image'
    ? [
        { uri: item.imageUrl, ratio: item.mediaAspectRatio },
        ...(item.additionalImages || []).map(({ url, aspectRatio }) => ({
          uri: url,
          ratio: aspectRatio,
        })),
      ]
    : [];
}
export function typeLabel(item: SavedItem) {
  return {
    x_post: 'X post',
    reddit_post: 'Reddit',
    instagram_post: 'Instagram',
    link: 'Link',
    image: 'Image',
    note: 'Note',
    code: 'Code',
    markdown: 'Markdown',
    secret: 'Secret',
    credential: 'Credential',
  }[item.type];
}
