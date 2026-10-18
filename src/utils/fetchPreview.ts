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

const CACHE_KEY = 'anything_link_previews_v3';
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

async function loadCover(images: string[]): Promise<string | undefined> {
  if (!images.length) return undefined;
  const pending: HTMLImageElement[] = [];
  let timeout: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      Promise.any(images.slice(0, 4).map(src => new Promise<string>((resolve, reject) => {
        const image = new Image();
        pending.push(image);
        image.onload = () => resolve(src);
        image.onerror = reject;
        image.src = src;
      }))),
      new Promise<undefined>(resolve => { timeout = setTimeout(resolve, 5000); }),
    ]);
  } catch { return undefined; }
  finally {
    clearTimeout(timeout!);
    for (const image of pending) { image.onload = null; image.onerror = null; image.src = ''; }
  }
}

async function fetchHtmlPreview(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  let html: string;
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return undefined;
    html = await response.text();
  } finally { clearTimeout(timeout); }
  const { data, images } = extractHtmlPreview(html, url);
  return { ...data, imageUrl: await loadCover(images) };
}

export function fetchLinkPreview(rawUrl: string, forceFresh = false): Promise<LinkPreviewData> {
  const url = normalizeUrl(rawUrl);
  const cached = previewCache.get(url);
  if (!forceFresh && cached && cached.expires > Date.now()) return Promise.resolve(cached.data);
  const pending = pendingPreviews.get(url);
  if (pending) return pending;

  if (forceFresh) previewCache.delete(url);
  const fallback = getImmediateLinkPreview(url);
  if (fallback.imageUrl || ['x.com', 'twitter.com'].includes(fallback.domain)) {
    return Promise.resolve(cachePreview(fallback));
  }

  const request = (async () => {
    // Browsers can read CORS-enabled pages directly, avoiding provider quotas entirely.
    if (typeof document !== 'undefined') {
      try {
        const direct = await fetchHtmlPreview(url);
        if (direct) return cachePreview(direct);
      } catch { /* Most sites require the metadata provider because of CORS. */ }
    }
    const controller = new AbortController();
    // Saving is already complete; allow the provider enough time to return real metadata.
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=false`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 429 ? 'Preview service is busy. Your link can still be saved.' : 'Preview unavailable. Your link can still be saved.');
      const json = await response.json();
      if (json.status !== 'success' || !json.data) throw new Error('Preview unavailable');
      const d = json.data;
      return cachePreview({
        ...fallback,
        title: typeof d.title === 'string' ? d.title : fallback.title,
        description: typeof d.description === 'string' ? d.description : undefined,
        imageUrl: safeWebUrl(typeof d.image === 'string' ? d.image : d.image?.url),
        publisher: typeof d.publisher === 'string' ? d.publisher : fallback.domain,
        author: typeof d.author === 'string' ? d.author : undefined,
        favicon: safeWebUrl(typeof d.logo === 'string' ? d.logo : d.logo?.url) || fallback.favicon,
      });
    } catch (error) {
      return cachePreview({ ...fallback, error: error instanceof Error ? error.message : 'Preview unavailable. You can still save this link.' }, 30_000);
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => pendingPreviews.delete(url));
  pendingPreviews.set(url, request);
  return request;
}
