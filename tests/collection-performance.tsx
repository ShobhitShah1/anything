import { createRoot } from 'react-dom/client';
import { Profiler } from 'react';
import { App } from '../src/App';
import '../src/index.css';
import '../src/design.css';
import { runCollectionChecks, runReleaseChecks } from './collection.browser.mjs';

const count = Math.min(10000, Number(new URLSearchParams(location.search).get('count')) || 3000);
const existing = JSON.parse(localStorage.getItem('anything_items_v2') || '[]');
if (!['127.0.0.1', 'localhost'].includes(location.hostname) || location.port !== '5175' ||
  !Array.isArray(existing) || existing.some(item => !String(item.id).startsWith('fixture-'))) {
  document.getElementById('results')!.textContent = 'Use a fresh localhost:5175 origin for this disposable fixture. Existing saves were left untouched.';
  throw new Error('Refusing to replace a real collection');
}
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#34343c"/><circle cx="330" cy="95" r="38" fill="#9999a4"/><path d="M0 280L120 180L240 260L400 170L480 250V320H0Z" fill="#666672"/></svg>')}`;
const items = Array.from({ length: count }, (_, index) => {
  const base = { id: `fixture-${index}`, title: `Saved thought ${index + 1}`, createdAt: 1793462400000 - index * 60000, tags: [], isPinned: index === 0 };
  switch (index % 6) {
    case 0: return { ...base, type: 'note', content: 'A place to keep a useful thought.\n'.repeat(1 + index % 9) };
    case 1: return { ...base, type: 'link', url: 'https://example.com', domain: 'example.com', description: 'A reference worth returning to.', previewImage: image };
    case 2: return { ...base, type: 'code', language: 'typescript', code: 'const keep = (thought: string) => thought;\n'.repeat(2 + index % 5) };
    case 3: return { ...base, type: 'markdown', content: '# Ideas worth saving\n\nA short document.\n\n- First idea\n- Another idea' };
    case 4: return { ...base, type: 'image', imageUrl: image, caption: 'Quiet scenery' };
    default: return { ...base, type: 'note', content: 'Things to remember', checklist: Array.from({ length: 1 + index % 7 }, (_, i) => ({ id: `check-${i}`, text: `Remember this ${i + 1}`, completed: false })) };
  }
});
localStorage.setItem('anything_items_v2', JSON.stringify(items));
localStorage.setItem('anything_auto_clipboard', 'false');
const renders: number[] = [];
createRoot(document.getElementById('root')!).render(<Profiler id="collection" onRender={(_id, _phase, duration) => renders.push(duration)}><App /></Profiler>);
document.getElementById('run-checks')!.onclick = async () => {
  const results = document.getElementById('results')!;
  results.textContent = 'Checking…';
  renders.length = 0;
  try {
    const result = await runCollectionChecks(count);
    renders.sort((a, b) => a - b);
    results.textContent = JSON.stringify({ ...result, renderP95Ms: Math.round(renders[Math.floor(renders.length * .95)] * 10) / 10, maxRenderMs: Math.round(Math.max(...renders) * 10) / 10 }, null, 2);
  }
  catch (error) { results.textContent = `FAIL: ${error}`; }
};
requestAnimationFrame(() => { (document.getElementById('run-checks') as HTMLButtonElement).disabled = false; });
document.getElementById('release-checks')!.onclick = async () => {
  const results = document.getElementById('results')!;
  results.textContent = 'Checking release…';
  try { results.textContent = JSON.stringify(await runReleaseChecks(), null, 2); }
  catch (error) { results.textContent = `FAIL: ${error}`; }
};
requestAnimationFrame(() => { (document.getElementById('release-checks') as HTMLButtonElement).disabled = false; });
document.getElementById('hide-checks')!.onclick = () => { document.querySelector('aside')!.hidden = true; };
