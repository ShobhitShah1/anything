export async function runCaptureMorphChecks() {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const wait = async (milliseconds, inspect) => { const end = performance.now() + milliseconds; while (performance.now() < end) { await frame(); inspect?.(); } };
  const dock = document.querySelector('[data-capture-source="capture"]');
  assert(dock, 'Capture dock is available');
  const results = [];
  for (const hold of [450, 80]) {
    const origin = dock.getBoundingClientRect();
    const scrollStart = scrollY;
    const openingOpacity = [];
    const openingWidths = [];
    dock.querySelector('.floating-save').click();
    await wait(hold, () => {
      const opening = document.querySelector('.capture-screen');
      if (opening) {
        openingOpacity.push(Number(getComputedStyle(opening).opacity));
        openingWidths.push(opening.getBoundingClientRect().width);
      }
      assert(!document.querySelector('[data-expansion-snapshot]'), 'Opening creates a blurred duplicate');
    });
    const panel = document.querySelector('.capture-screen');
    assert(panel && panel.closest('dialog[open]'), 'Composer opens as a modal');
    assert(dock.getBoundingClientRect().width > 0, 'Dock was removed before it could expand');
    assert(getComputedStyle(dock).visibility === 'hidden' || Number(getComputedStyle(dock).opacity) < 1, 'Dock remains fully visible underneath the composer');
    assert(getComputedStyle(dock.closest('.collection-surface')).display !== 'none', 'Opening hides the collection and loses the source geometry');
    if (hold === 450) {
      const frames = panel.getAnimations().flatMap(animation => animation.effect.getKeyframes());
      const initial = frames.find(keyframe => keyframe.transform && keyframe.transform !== 'none');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        assert(initial, 'Composer did not expand from the dock');
        const matrix = new DOMMatrix(initial.transform);
        assert(Math.abs(matrix.a - matrix.d) < .001, 'Dock expansion stretches text out of proportion');
      }
      const box = panel.getBoundingClientRect();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        assert(openingWidths.some(width => width < box.width * .9), 'Composer only fades instead of visibly expanding');
        assert(openingOpacity.every(opacity => opacity > .95), 'Expansion surface fades instead of growing from the dock');
      }
      assert(Math.abs(box.left + box.width / 2 - innerWidth / 2) < 2, 'Composer is not centered');
      assert(Math.abs(box.top + box.height / 2 - innerHeight / 2) < 2, 'Composer is not vertically centered');
      assert(!document.querySelector('[data-expansion-snapshot]'), 'Dock creates a second blurred surface while opening');
      assert(Math.abs(scrollY - scrollStart) < 1, 'Opening scrolls the page to the editor');
      assert(openingOpacity.every((opacity, index) => !index || opacity >= openingOpacity[index - 1] - .01), 'Opening opacity drops and causes a flash');
      assert(box.top >= 0 && box.bottom <= innerHeight, 'Composer clips the viewport');
      assert(panel.querySelectorAll('.capture-type-options > button').length === 4, 'Common types are immediately available');
      const textarea = document.querySelector('#capture-note-content');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'A draft worth keeping.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await frame();
      const save = [...panel.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save memory');
      assert(save && !save.disabled, 'Writing enables Save');
      panel.querySelector('.capture-preview-toggle').click();
      await frame();
      assert(document.querySelector('#capture-live-preview').textContent.includes('A draft worth keeping.'), 'Preview contains the draft');
      panel.querySelector('.capture-preview-toggle').click();
      await frame();
      assert(document.querySelector('#capture-note-content').value === 'A draft worth keeping.', 'Draft survives preview switching');
    }
    const editor = panel.querySelector('.capture-editor');
    const editorOpacity = Number(getComputedStyle(editor).opacity);
    const closingWidth = panel.getBoundingClientRect().width;
    const closingBox = panel.getBoundingClientRect();
    const closingWidths = [];
    panel.closest('dialog').querySelector('.capture-backdrop').click();
    const deadline = performance.now() + 5000;
    while (document.querySelector('.capture-dialog') && performance.now() < deadline) {
      assert(Number(getComputedStyle(editor).opacity) <= editorOpacity + .05, 'Editor flashes when expansion is cancelled');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        assert(Number(getComputedStyle(panel).opacity) > .95, 'Composer fades during its return to the dock');
        assert(Math.abs(Number(getComputedStyle(editor).opacity) - editorOpacity) < .05, 'Editor fades away before the composer shrinks');
        const box = panel.getBoundingClientRect();
        closingWidths.push(box.width);
        assert(!document.querySelector('[data-expansion-snapshot]'), 'Closing introduces an extra dock layer');
        if (hold === 450 && Math.abs(closingWidth - origin.width) > 1) {
          const progress = (closingWidth - box.width) / (closingWidth - origin.width);
          const startY = closingBox.top + closingBox.height / 2;
          const endY = origin.top + origin.height / 2;
          assert(Math.abs(box.top + box.height / 2 - (startY + (endY - startY) * progress)) < 2, 'Closing surface veers away from its path to the dock');
        }
      }
      await frame();
    }
    if (hold === 450 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      assert(closingWidths.some(width => width < closingWidth * .9), 'Composer disappears without shrinking');
      assert(closingWidths.every((width, index) => !index || width <= closingWidths[index - 1] + 1), 'Closing surface jumps back to a larger size');
    }
    assert(!document.querySelector('.capture-dialog'), 'Composer did not finish collapsing');
    assert(panel.style.visibility === 'hidden', 'Unmount can expose the full-size composer after cancelling its transform');
    assert(getComputedStyle(dock).visibility !== 'hidden', 'Dock did not return');
    assert(!document.querySelector('[data-expansion-snapshot]'), 'An animation snapshot was left behind');
    assert(Math.abs(dock.getBoundingClientRect().top - origin.top) < 2, 'Dock returned to a different position');
    assert(Math.abs(scrollY - scrollStart) < 1, 'Closing changed the collection scroll position');
    results.push({ scenario: hold === 80 ? 'cancel during expansion' : 'edit, preview, outside cancel', result: 'PASS' });
  }
  return results;
}

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
