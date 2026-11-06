// Run through the dev-only collection-performance.html fixture on an isolated port.
export async function runReleaseChecks() {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  const results = [];
  for (const hold of [450, 80]) {
    const source = document.querySelector('[data-card-id="fixture-0"]');
    const origin = source.getBoundingClientRect();
    source.click();
    const opened = performance.now();
    while (performance.now() - opened < hold) await frame();
    const dialog = document.querySelector('dialog[open]');
    assert(dialog, 'Card did not open');
    dialog.querySelector(':scope > .fixed.inset-0').click();
    const released = performance.now();
    let blended = false;
    while (dialog.isConnected && performance.now() - released < 5000) {
      blended ||= Boolean(dialog.querySelector('.memory-card[aria-hidden="true"]'));
      await frame();
    }
    const elapsed = performance.now() - released;
    assert(!dialog.isConnected, 'Return animation never completed');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      assert(elapsed >= 300, 'Dialog was removed before the return could settle');
      assert(blended, 'Return did not blend into the original card');
    }
    assert(getComputedStyle(source).visibility !== 'hidden', 'Original card stayed hidden');
    assert(!document.querySelector('.memory-card[aria-hidden="true"]'), 'Snapshot was left behind');
    assert(
      Math.abs(source.getBoundingClientRect().top - origin.top) < 2,
      'Returning changed the scroll position',
    );
    results.push({
      scenario: hold === 80 ? 'dismiss during expansion' : 'dismiss after expansion',
      returnMs: Math.round(elapsed),
      result: 'PASS',
    });
  }
  return results;
}

export async function runCollectionChecks(total) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const settle = async () => {
    const start = performance.now();
    let previous = '',
      stable = 0;
    while (performance.now() - start < 15000) {
      await frame();
      const signature = [...document.querySelectorAll('[data-index]')]
        .map((element) => {
          const box = element.getBoundingClientRect();
          return `${element.dataset.itemId}:${box.x}:${box.y}:${box.width}:${box.height}`;
        })
        .join('|');
      stable = signature === previous ? stable + 1 : 0;
      previous = signature;
      if (stable >= 3 && performance.now() - start >= 400) return;
    }
    throw new Error('Layout did not settle within fifteen seconds');
  };
  const selector = document.querySelector('.memory-list-row') ? '.memory-list-row' : '.memory-card';
  const transition = async (
    source = [...document.querySelectorAll(selector)].find((element) => {
      const box = element.getBoundingClientRect();
      return box.top >= 0 && box.top < innerHeight - 80;
    }),
  ) => {
    const before = source.getBoundingClientRect();
    source.click();
    const opening = [];
    const end = performance.now() + 450;
    while (performance.now() < end) {
      await frame();
      const detail = document.querySelector('.memory-detail, .memory-reader');
      if (detail) opening.push(getComputedStyle(detail).transform);
    }
    const dialog = document.querySelector('dialog[open]');
    assert(dialog, 'Detail did not open as a modal dialog');
    const panel = dialog.querySelector('.memory-detail') || dialog;
    const panelBox = panel.getBoundingClientRect();
    assert(
      Math.abs(panelBox.left + panelBox.width / 2 - innerWidth / 2) < 2 &&
        Math.abs(panelBox.top + panelBox.height / 2 - innerHeight / 2) < 2,
      'Opened view is not centered',
    );
    assert(
      getComputedStyle(source).visibility === 'hidden',
      'Source card remains visible behind the moving view',
    );
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      assert(
        opening.some((value) => value !== 'none'),
        `Detail faded in without a shared transform (${opening.length} frames)`,
      );
    }
    const outside = dialog.querySelector(':scope > .fixed.inset-0');
    if (outside) outside.click();
    else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const closeDeadline = performance.now() + 2000;
    while (document.querySelector('dialog[open]') && performance.now() < closeDeadline)
      await frame();
    await settle();
    assert(!document.querySelector('dialog[open]'), 'Dialog did not finish closing');
    assert(source.isConnected, 'Shared source was recycled during the transition');
    assert(
      getComputedStyle(source).visibility !== 'hidden',
      'Source card did not reappear after returning',
    );
    const after = source.getBoundingClientRect();
    assert(
      Math.abs(before.top - after.top) < 2 && Math.abs(before.left - after.left) < 2,
      'Closing changed the scroll position',
    );
    return 'PASS: shared transform, modal exit, source retained, scroll restored';
  };
  const check = () => {
    const elements = [...document.querySelectorAll(selector)];
    assert(
      elements.length > 0 && elements.length < 150,
      `Mounted ${elements.length} of ${total}; expected a bounded window`,
    );
    const boxes = elements.map((element) => element.getBoundingClientRect());
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        assert(
          !(
            a.left < b.right - 2 &&
            a.right > b.left + 2 &&
            a.top < b.bottom - 2 &&
            a.bottom > b.top + 2
          ),
          `Cards overlap: ${elements[i].getAttribute('aria-label')} / ${elements[j].getAttribute('aria-label')}`,
        );
      }
    assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Page overflows horizontally');
    return elements.length;
  };
  window.scrollTo(0, 0);
  await settle();
  const initialMounted = check();
  const topTransition = await transition();
  const readerTransition = await transition(document.querySelector('[data-card-id="fixture-3"]'));
  const firstId = document.querySelector('[data-item-id]')?.dataset.itemId;
  const deltas = [];
  let previous = performance.now();
  for (let i = 0; i < 45; i++) {
    window.scrollBy(0, 180);
    await frame();
    const now = performance.now();
    deltas.push(now - previous);
    previous = now;
  }
  await settle();
  const scrolledMounted = check();
  const deepTransition = await transition();
  assert(
    document.querySelector('[data-item-id]')?.dataset.itemId !== firstId,
    'Scroll did not advance the rendered window',
  );
  window.scrollTo(0, document.documentElement.scrollHeight);
  await settle();
  check();
  assert(
    [...document.querySelectorAll('[data-item-id]')].some(
      (element) => element.dataset.itemId === `fixture-${total - 1}`,
    ),
    'Last item is unreachable',
  );
  window.scrollTo(0, 0);
  await settle();
  check();
  deltas.sort((a, b) => a - b);
  return {
    total,
    initialMounted,
    scrolledMounted,
    scrollFrameP95Ms: Math.round(deltas[Math.floor(deltas.length * 0.95)]),
    topTransition,
    readerTransition,
    deepTransition,
    result:
      'PASS: bounded DOM, no overlap, no horizontal overflow, last item reachable, return to top',
  };
}
