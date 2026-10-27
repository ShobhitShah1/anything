export function safeLink(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('Only web links can be opened.');
  return url.href;
}
