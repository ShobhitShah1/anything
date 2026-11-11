import { AccessError } from './access.ts';
import { firebase, type FirebaseEnv } from './firebase.ts';

type PreviewEnv = FirebaseEnv;
type Preview = {
  title: string;
  description?: string;
  imageUrl?: string;
  publisher?: string;
  author?: string;
  favicon?: string;
  domain: string;
  url: string;
};

function publicUrl(value: string, base?: string): URL | undefined {
  try {
    const url = new URL(value, base);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port &&
        !(url.protocol === 'http:' && url.port === '80') &&
        !(url.protocol === 'https:' && url.port === '443')) ||
      !host.includes('.') ||
      /^(?:\d+\.){3}\d+$/.test(host) ||
      /^[0-9a-f:]+$/i.test(host) ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
    )
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export function isPublicPreviewUrl(value: string) {
  return !!publicUrl(value);
}

function structuredMetadata(html: string) {
  const objects: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const stack: unknown[] = [JSON.parse(match[1])];
      let inspected = 0;
      while (stack.length && inspected++ < 1000) {
        const value = stack.pop();
        if (Array.isArray(value)) stack.push(...value.slice(0, 100));
        else if (value && typeof value === 'object') {
          const record = value as Record<string, unknown>;
          objects.push(record);
          stack.push(...Object.values(record).slice(0, 50));
        }
      }
    } catch {
      // Ignore malformed JSON-LD and keep using the page's standard metadata.
    }
  }
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const named = (value: unknown) =>
    text(value) ||
    (value && typeof value === 'object' && !Array.isArray(value)
      ? text((value as Record<string, unknown>).name)
      : undefined);
  const image = (value: unknown): string | undefined => {
    if (Array.isArray(value)) return value.map(image).find(Boolean);
    return (
      text(value) ||
      (value && typeof value === 'object'
        ? text((value as Record<string, unknown>).url) ||
          text((value as Record<string, unknown>).contentUrl)
        : undefined)
    );
  };
  return {
    title:
      objects.map((item) => text(item.headline)).find(Boolean) ||
      objects.map((item) => text(item.name)).find(Boolean),
    description: objects.map((item) => text(item.description)).find(Boolean),
    image: objects.map((item) => image(item.image)).find(Boolean),
    author: objects.map((item) => named(item.author)).find(Boolean),
    publisher: objects.map((item) => named(item.publisher)).find(Boolean),
  };
}

async function readHtml(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512_000)
        throw new AccessError('page_too_large', 'This page is too large to preview.', 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function extractPreview(html: string, pageUrl: string): Promise<Preview> {
  const values = new Map<string, string>();
  let title = '';
  const set = (key: string | null, value: string | null) => {
    const normalized = key?.trim().toLowerCase();
    const text = value?.trim();
    if (normalized && text && !values.has(normalized)) values.set(normalized, text);
  };
  const rewriter = new HTMLRewriter()
    .on('meta', {
      element(element) {
        set(
          element.getAttribute('property') ||
            element.getAttribute('name') ||
            element.getAttribute('itemprop'),
          element.getAttribute('content'),
        );
      },
    })
    .on('title', {
      text(text) {
        title += text.text;
      },
    })
    .on('link', {
      element(element) {
        const rel = element.getAttribute('rel')?.toLowerCase().split(/\s+/) || [];
        if (rel.includes('icon') || rel.includes('shortcut'))
          set('icon', element.getAttribute('href'));
        if (rel.includes('canonical')) set('canonical', element.getAttribute('href'));
      },
    });
  await rewriter.transform(new Response(html, { headers: { 'Content-Type': 'text/html' } })).text();

  const original = new URL(pageUrl);
  const jsonLd = structuredMetadata(html);
  const pick = (...keys: string[]) => keys.map((key) => values.get(key)).find(Boolean);
  const absolute = (value?: string) => {
    if (!value) return undefined;
    const resolved = publicUrl(value, pageUrl);
    return resolved?.href;
  };
  const cleanTitle = (value?: string) => value?.replace(/\s+/g, ' ').trim().slice(0, 300);
  const titleText =
    cleanTitle(pick('og:title', 'twitter:title')) ||
    cleanTitle(jsonLd.title) ||
    cleanTitle(title) ||
    original.hostname;
  const description = cleanTitle(
    pick('og:description', 'twitter:description', 'description') || jsonLd.description,
  );
  const imageUrl = absolute(
    pick('og:image', 'og:image:url', 'twitter:image', 'twitter:image:src') || jsonLd.image,
  );
  const favicon =
    absolute(values.get('icon')) ||
    `https://www.google.com/s2/favicons?domain=${original.hostname}&sz=128`;
  const publisher = cleanTitle(pick('og:site_name', 'application-name') || jsonLd.publisher);
  const author = cleanTitle(pick('author', 'article:author') || jsonLd.author);
  return {
    title: titleText,
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(publisher ? { publisher } : {}),
    ...(author ? { author } : {}),
    favicon,
    domain: original.hostname.replace(/^www\./, ''),
    url: pageUrl,
  };
}

export async function handlePreview(request: Request, env: PreviewEnv): Promise<Response> {
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new AccessError('sign_in_required', 'Sign in to load link previews.', 401);
    await firebase(env).identify(token);

    if (!request.headers.get('Content-Type')?.startsWith('application/json'))
      throw new AccessError('invalid_request', 'Send the preview URL as JSON.', 400);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 4096) throw new AccessError('invalid_request', 'Provide a shorter URL.', 413);
    const reader = request.body?.getReader();
    if (!reader) throw new AccessError('invalid_request', 'Provide a valid web URL.', 400);
    let raw = '';
    let size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          raw += decoder.decode();
          break;
        }
        size += chunk.value.byteLength;
        if (size > 4096) throw new AccessError('invalid_request', 'Provide a shorter URL.', 413);
        raw += decoder.decode(chunk.value, { stream: true });
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    let body: { url?: unknown };
    try {
      body = JSON.parse(raw) as { url?: unknown };
    } catch {
      throw new AccessError('invalid_request', 'Provide a valid web URL.', 400);
    }
    if (!body || typeof body.url !== 'string' || body.url.length > 2048)
      throw new AccessError('invalid_request', 'Provide a valid web URL.', 400);
    let target = publicUrl(body.url);
    if (!target)
      throw new AccessError('invalid_url', 'Only public http or https URLs can be previewed.', 400);

    let response: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects++) {
      response = await fetch(target.href, {
        redirect: 'manual',
        headers: { Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(4500),
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('Location');
      await response.body?.cancel();
      target = location ? publicUrl(location, target.href) : undefined;
      if (!target)
        throw new AccessError('invalid_redirect', 'This page redirected to an unsafe URL.', 400);
    }
    if (!response || [301, 302, 303, 307, 308].includes(response.status))
      throw new AccessError('too_many_redirects', 'This page redirected too many times.', 400);
    if (!response.ok)
      throw new AccessError('page_unavailable', 'This page could not be opened.', 502);
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('html'))
      throw new AccessError('not_html', 'This URL does not serve a web page.', 415);
    const html = await readHtml(response);
    return Response.json(await extractPreview(html, target.href), {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (error) {
    const known = error instanceof AccessError;
    return Response.json(
      {
        error: known ? error.code : 'preview_unavailable',
        message: known ? error.message : 'This page could not be previewed.',
      },
      { status: known ? error.status : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
