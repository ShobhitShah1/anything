export async function runCaptureChecks() {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const title = document.getElementById('capture-title');
  const content = document.getElementById('capture-note-content');
  const preview = document.getElementById('capture-live-preview');
  assert(title && content && preview, 'Note editor is available');
  assert(getComputedStyle(preview).display === 'none', 'Preview is optional');
  assert(getComputedStyle(title).boxShadow === 'none', 'No full-width focus underline');
  const fill = (element, value, prototype) => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  fill(title, 'A useful note', HTMLInputElement.prototype);
  fill(content, 'A calm place to write and save.', HTMLTextAreaElement.prototype);
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  await frame();
  document.querySelector('.capture-preview-toggle').click();
  await frame();
  assert(getComputedStyle(preview).display !== 'none', 'Preview opens');
  assert(preview.textContent.includes('A useful note'), 'Preview contains the draft');
  document.querySelector('.capture-preview-toggle').click();
  await frame();
  assert(content.value === 'A calm place to write and save.', 'Draft survives preview');
  return 'PASS: clean title focus, optional preview, preserved draft.';
}
