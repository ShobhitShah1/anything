import type { SavedItem } from '../shared/types';
export function itemText(item: SavedItem) {
  switch (item.type) {
    case 'code':
      return item.code;
    case 'secret':
      return item.secretValue;
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
export function itemImage(item: SavedItem) {
  return 'imageUrl' in item ? item.imageUrl : item.type === 'link' ? item.previewImage : undefined;
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
  }[item.type];
}
