export function parseSocialUrl(url: string): {
  detectedType: 'x_post' | 'reddit_post' | 'instagram_post' | 'image' | 'link';
  extractedInfo?: {
    handle?: string;
    subreddit?: string;
    title?: string;
  };
} {
  const clean = url.trim();

  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`).hostname.replace(
      /^www\./,
      '',
    );
  } catch {
    return { detectedType: 'link', extractedInfo: { title: 'Link' } };
  }

  // X / Twitter
  if (['twitter.com', 'x.com', 'mobile.twitter.com'].includes(host)) {
    const match = clean.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    const handle = match ? match[1] : 'user';
    return {
      detectedType: 'x_post',
      extractedInfo: { handle, title: `@${handle}` },
    };
  }

  // Reddit
  if (['reddit.com', 'old.reddit.com'].includes(host)) {
    const subMatch = clean.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/);
    const sub = subMatch ? `r/${subMatch[1]}` : 'r/reddit';
    return {
      detectedType: 'reddit_post',
      extractedInfo: { subreddit: sub, title: sub },
    };
  }

  // Instagram
  if (host === 'instagram.com') {
    const instaMatch = clean.match(/instagram\.com\/(?:p|reel|([a-zA-Z0-9_.]+))/);
    const handle = instaMatch && instaMatch[1] ? instaMatch[1] : 'instagram';
    return {
      detectedType: 'instagram_post',
      extractedInfo: { handle, title: `@${handle}` },
    };
  }

  // Image URL
  if (clean.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i)) {
    return {
      detectedType: 'image',
      extractedInfo: { title: 'Image' },
    };
  }

  // Generic Link
  return {
    detectedType: 'link',
    extractedInfo: { title: 'Link' },
  };
}
