import { extractHtmlPreview } from '../src/utils/fetchPreview.ts';

export function runMetadataChecks() {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const { data, images } = extractHtmlPreview(`
    <html><head><title>Fallback title</title>
    <meta property="og:title" content="A &amp; B">
    <meta property="og:description" content="A useful page">
    <meta property="og:image" content="/cover.png">
    <link rel="icon" href="./icon.svg"></head>
    <body><script>window.__previewScriptRan = true</script></body></html>
  `, 'https://example.com/articles/one');
  assert(data.title === 'A & B', 'Parse HTML entities and prefer Open Graph title');
  assert(data.description === 'A useful page', 'Read the actual description');
  assert(images[0] === 'https://example.com/cover.png', 'Resolve root-relative covers');
  assert(data.favicon === 'https://example.com/articles/icon.svg', 'Resolve relative favicon');
  assert(!window.__previewScriptRan, 'Never execute scripts from fetched pages');

  const mirror = extractHtmlPreview(`
    <meta property="og:url" content="https://everyspend.app/">
    <meta property="og:image" content="https://everyspend.app/opengraph-image?123">
  `, 'https://shobhitshah1.github.io/EverySpend-Website/');
  assert(mirror.images.includes('https://shobhitshah1.github.io/EverySpend-Website/opengraph-image?123'), 'Recover GitHub Pages mirror assets');

  const unsafe = extractHtmlPreview('<meta property="og:image" content="javascript:alert(1)">', 'https://example.com');
  assert(unsafe.images.length === 0, 'Reject script URLs');
  const noCover = extractHtmlPreview('<title>Plain page</title>', 'https://example.com');
  assert(noCover.data.title === 'Plain page' && noCover.images.length === 0, 'Do not invent a missing image');
  return 'PASS: real HTML parsing, relative assets, mirror covers, script safety, missing images.';
}
