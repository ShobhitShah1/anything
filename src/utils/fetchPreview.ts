import type { SavedItem } from '../types';

export interface LinkPreviewData {
  title: string;
  description?: string;
  imageUrl?: string;
  publisher?: string;
  author?: string;
  authorHandle?: string;
  authorAvatar?: string;
  favicon?: string;
  domain: string;
  url: string;
  likes?: number;
  reposts?: number;
  error?: string;
}

const CACHE_KEY = 'anything_link_previews_v4';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const previewCache = new Map<string, { data: LinkPreviewData; expires: number }>();
const pendingPreviews = new Map<string, Promise<LinkPreviewData>>();
try {
  const entries = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '[]');
  if (Array.isArray(entries)) {
    for (const [url, entry] of entries.slice(-100)) {
      if (entry?.expires > Date.now() && entry.data?.url === url) previewCache.set(url, entry);
    }
  }
} catch { /* Storage is optional in private browsing. */ }

function cachePreview(data: LinkPreviewData, ttl = CACHE_TTL) {
  previewCache.delete(data.url);
  previewCache.set(data.url, { data, expires: Date.now() + ttl });
  if (previewCache.size > 100) previewCache.delete(previewCache.keys().next().value!);
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify([...previewCache])); } catch { /* Cache is optional. */ }
  return data;
}

function safeWebUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : undefined;
  } catch { return undefined; }
}

// Ensure URL has http/https protocol
export function normalizeUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) throw new Error('Use an http or https URL.');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  const parsed = new URL(url);
  if (parsed.username || parsed.password) throw new Error('Use a URL without embedded credentials.');
  return parsed.href;
}

export function isDirectImageUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const pathname = parsed.pathname.toLowerCase();
    return (
      /\.(jpeg|jpg|gif|png|webp|svg|avif|bmp)($|\?)/i.test(pathname) ||
      parsed.hostname === 'images.unsplash.com' ||
      parsed.hostname === 'i.imgur.com' ||
      parsed.hostname === 'pbs.twimg.com'
    );
  } catch {
    return false;
  }
}

export function getImmediateLinkPreview(rawUrl: string): LinkPreviewData {
  const url = normalizeUrl(rawUrl);
  const cached = previewCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;

  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/^www\./, '');

  const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  // 1. Direct Image URL (Unsplash, imgur, png, jpg, etc.)
  if (isDirectImageUrl(url)) {
    const filename = url.split('/').pop()?.split('?')[0] || domain;
    const directPreview: LinkPreviewData = {
      title: filename || domain,
      imageUrl: url,
      domain,
      url,
      favicon: fallbackFavicon,
    };
    return directPreview;
  }

  // 2. YouTube Video
  const videoId = domain === 'youtu.be' ? parsed.pathname.slice(1).split('/')[0]
    : parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|v|shorts)\/([\w-]+)/)?.[1];
  if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(domain) && videoId && /^[\w-]{11}$/.test(videoId)) {
    const ytPreview: LinkPreviewData = {
      title: domain,
      description: 'YouTube Video',
      imageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      domain: 'youtube.com',
      url,
      favicon: 'https://www.youtube.com/s/desktop/f8c2b740/img/favicon_144x144.png',
    };
    return ytPreview;
  }

  // 3. GitHub Repository
  const ghMatch = url.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
  if (domain === 'github.com' && ghMatch && !['features', 'topics', 'trending', 'collections'].includes(ghMatch[1])) {
    const owner = ghMatch[1];
    const repo = ghMatch[2].replace(/\.git$/, '');
    const ghPreview: LinkPreviewData = {
      title: `${owner}/${repo}`,
      description: `GitHub repository: ${owner}/${repo}`,
      imageUrl: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
      author: owner,
      authorAvatar: `https://unavatar.io/github/${owner}`,
      publisher: 'GitHub',
      domain: 'github.com',
      url,
      favicon: 'https://github.githubassets.com/favicons/favicon.svg',
    };
    return ghPreview;
  }

  // 4. Twitter / X Posts
  if (domain === 'twitter.com' || domain === 'x.com') {
    const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    const handle = tweetMatch ? tweetMatch[1] : 'creator';
    const preview: LinkPreviewData = {
      title: `@${handle}`,
      description: `Post by @${handle} on X`,
      author: handle,
      authorHandle: `@${handle}`,
      authorAvatar: `https://unavatar.io/twitter/${handle}`,
      domain: 'x.com',
      url,
      favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
    };
    return preview;
  }

  return { title: domain, domain, url, favicon: fallbackFavicon };
}

// Parse in an inert template: links and scripts from the page are never executed.
export function extractHtmlPreview(html: string, pageUrl: string) {
  const template = document.createElement('template');
  template.innerHTML = html.slice(0, 1_000_000);
  const root = template.content;
  const meta = (name: string) => root.querySelector<HTMLMetaElement>(`meta[property="${name}"], meta[name="${name}"]`)?.content;
  const page = new URL(pageUrl);
  const base = root.querySelector('base[href]')?.getAttribute('href');
  const resolve = (value?: string | null) => {
    try { return value ? safeWebUrl(new URL(value, base ? new URL(base, page) : page).href) : undefined; }
    catch { return undefined; }
  };
  const images = [meta('og:image'), meta('og:image:url'), meta('twitter:image'), root.querySelector('link[rel="image_src"]')?.getAttribute('href')]
    .map(resolve).filter((value): value is string => Boolean(value));
  const canonical = resolve(meta('og:url'));
  // GitHub Pages mirrors sometimes still advertise their old custom-domain asset URLs.
  if (page.hostname.endsWith('.github.io') && canonical) {
    for (const image of [...images]) {
      const asset = new URL(image);
      if (asset.origin === new URL(canonical).origin && asset.origin !== page.origin) {
        const mirror = new URL(asset.pathname.slice(1) + asset.search, new URL('./', page));
        images.push(mirror.href);
      }
    }
  }
  const data: LinkPreviewData = {
    ...getImmediateLinkPreview(pageUrl),
    title: meta('og:title') || meta('twitter:title') || root.querySelector('title')?.textContent?.trim() || page.hostname,
    description: meta('og:description') || meta('twitter:description') || meta('description'),
    publisher: meta('og:site_name'),
    favicon: resolve(root.querySelector('link[rel~="icon"]')?.getAttribute('href')) || getImmediateLinkPreview(pageUrl).favicon,
  };
  return { data, images: [...new Set(images)] };
}

const PREVIEW_DEADLINE = 5000;

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(response.status === 429 ? 'Preview service is busy. Try again shortly.' : response.status === 404 ? 'This URL is unavailable or was removed.' : 'This page could not be previewed.');
  return response.json();
}

async function fetchMetadata(url: string, fallback: LinkPreviewData, signal: AbortSignal, forceFresh: boolean) {
  const params = new URLSearchParams({ url, retry: '0', timeout: '4500', prerender: 'auto', force: String(forceFresh) });
  const json = await fetchJson(`https://api.microlink.io?${params}`, signal);
  if (json.status !== 'success' || !json.data) throw new Error('This page could not be previewed.');
  const data = json.data;
  return {
    ...fallback,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : fallback.title,
    description: typeof data.description === 'string' ? data.description : undefined,
    imageUrl: safeWebUrl(typeof data.image === 'string' ? data.image : data.image?.url) || fallback.imageUrl,
    publisher: typeof data.publisher === 'string' ? data.publisher : fallback.domain,
    author: typeof data.author === 'string' ? data.author : undefined,
    favicon: safeWebUrl(typeof data.logo === 'string' ? data.logo : data.logo?.url) || fallback.favicon,
  };
}

async function fetchHtmlPreview(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'text/html' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Page metadata unavailable.');
  const { data, images } = extractHtmlPreview(await response.text(), url);
  if (!data.description && !images.length && data.title === new URL(url).hostname) throw new Error('Page has no metadata.');
  // Show metadata immediately; image loading must never delay the preview.
  return { ...data, imageUrl: images[0] };
}

async function fetchXPreview(url: string, fallback: LinkPreviewData, signal: AbortSignal) {
  const id = new URL(url).pathname.match(/^\/(?:[^/]+\/status|i\/web\/status)\/(\d+)/)?.[1];
  if (!id) throw new Error('Paste an X post URL containing /status/ and the post ID.');
  const json = await fetchJson(`https://api.fxtwitter.com/status/${id}`, signal);
  const tweet = json.tweet;
  if (json.code !== 200 || !tweet || typeof tweet.text !== 'string') throw new Error('This X post is unavailable, private, or deleted.');
  return {
    ...fallback,
    title: typeof tweet.author?.name === 'string' ? tweet.author.name : fallback.title,
    description: tweet.text,
    author: typeof tweet.author?.name === 'string' ? tweet.author.name : undefined,
    authorHandle: typeof tweet.author?.screen_name === 'string' ? `@${tweet.author.screen_name}` : fallback.authorHandle,
    authorAvatar: safeWebUrl(tweet.author?.avatar_url),
    imageUrl: safeWebUrl(tweet.media?.photos?.[0]?.url || tweet.media?.videos?.[0]?.thumbnail_url || tweet.media?.external?.thumbnail_url),
    likes: typeof tweet.likes === 'number' ? tweet.likes : undefined,
    reposts: typeof tweet.retweets === 'number' ? tweet.retweets : undefined,
    publisher: 'X',
  };
}

async function fetchVideoPreview(url: string, fallback: LinkPreviewData, signal: AbortSignal) {
  const data = await fetchJson(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, signal);
  if (data.error || typeof data.title !== 'string') throw new Error('Video metadata unavailable.');
  return { ...fallback, title: data.title, author: typeof data.author_name === 'string' ? data.author_name : undefined, imageUrl: safeWebUrl(data.thumbnail_url) || fallback.imageUrl };
}

export function fetchLinkPreview(rawUrl: string, forceFresh = false): Promise<LinkPreviewData> {
  const url = normalizeUrl(rawUrl);
  const cached = previewCache.get(url);
  if (!forceFresh && cached && cached.expires > Date.now()) return Promise.resolve(cached.data);
  const pending = pendingPreviews.get(url);
  if (pending) return pending;
  if (forceFresh) previewCache.delete(url);
  const fallback = getImmediateLinkPreview(url);
  if (isDirectImageUrl(url)) return Promise.resolve(cachePreview(fallback));

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PREVIEW_DEADLINE);
    try {
      let data: LinkPreviewData;
      if (['x.com', 'twitter.com', 'mobile.twitter.com'].includes(fallback.domain)) {
        data = await fetchXPreview(url, fallback, controller.signal);
      } else if (['youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com'].includes(fallback.domain)) {
        data = await fetchVideoPreview(url, fallback, controller.signal);
      } else {
        const providers: Promise<LinkPreviewData>[] = [fetchMetadata(url, fallback, controller.signal, forceFresh)];
        if (typeof document !== 'undefined') providers.push(fetchHtmlPreview(url, controller.signal));
        data = await Promise.any(providers);
      }
      const { error: _oldError, ...clean } = data;
      return cachePreview(clean);
    } catch (error) {
      const errors = error instanceof AggregateError ? error.errors : [error];
      const message = controller.signal.aborted ? 'Preview timed out. You can save now and retry later.'
        : errors.find(problem => problem instanceof Error && problem.message.includes('busy'))?.message
        || errors.find(problem => problem instanceof Error)?.message || 'Preview unavailable. You can still save this link.';
      return cachePreview({ ...fallback, error: message }, 15_000);
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  })().finally(() => pendingPreviews.delete(url));
  pendingPreviews.set(url, request);
  return request;
}

export function applyLinkPreview(item: SavedItem, preview: LinkPreviewData): SavedItem {
  if (preview.error) return item;
  if (item.type === 'link') return {
    ...item,
    title: !item.title || [item.domain, item.url, 'Link'].includes(item.title) ? preview.title : item.title,
    description: item.description || preview.description,
    previewImage: item.previewImage || preview.imageUrl,
    favicon: preview.favicon || item.favicon,
  };
  if (item.type === 'x_post') return {
    ...item,
    authorName: preview.author || item.authorName,
    authorHandle: preview.authorHandle || item.authorHandle,
    authorAvatar: preview.authorAvatar || item.authorAvatar,
    content: !item.content || item.content === item.postUrl || item.content === 'Post on X' || /^Post by @\w+ on X$/.test(item.content) ? preview.description || item.content : item.content,
    imageUrl: preview.imageUrl || item.imageUrl,
    likes: preview.likes ?? item.likes,
    reposts: preview.reposts ?? item.reposts,
  };
  if (item.type === 'reddit_post') return {
    ...item,
    title: !item.title || item.title === item.subreddit || item.title === 'Reddit post' ? preview.title : item.title,
    author: preview.author || item.author,
    content: item.content || preview.description || '',
    imageUrl: preview.imageUrl || item.imageUrl,
  };
  if (item.type === 'instagram_post') return {
    ...item,
    handle: preview.authorHandle || item.handle,
    caption: item.caption || preview.description || '',
    imageUrl: preview.imageUrl || item.imageUrl,
  };
  return item;
}
