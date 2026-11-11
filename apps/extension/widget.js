(() => {
  const current = document.getElementById('anything-save-widget');
  if (current) {
    current.remove();
    return;
  }

  if (!window.__anythingPointerInstalled) {
    window.__anythingPointerInstalled = true;
    const remember = (event) => {
      window.__anythingContextPoint = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener('contextmenu', remember, true);
    document.addEventListener('pointermove', remember, { capture: true, passive: true });
  }

  const size = 300;
  const point = window.__anythingContextPoint;
  const clamp = (value, half, extent) =>
    Math.max(Math.min(half + 8, extent / 2), Math.min(Math.max(extent - half - 8, extent / 2), value));
  const x = clamp(point?.x ?? innerWidth / 2, size / 2, innerWidth);
  const y = clamp(point?.y ?? innerHeight / 2, size / 2, innerHeight);
  const clickedLink = point && document.elementFromPoint(point.x, point.y)?.closest('a');
  if (clickedLink === document.activeElement) clickedLink.blur();

  const host = document.createElement('div');
  host.id = 'anything-save-widget';
  host.style.cssText = `all:initial;display:block;position:fixed;z-index:2147483647;left:${x}px;top:${y}px;transform:translate(-50%,-50%);`;
  const shadow = host.attachShadow({ mode: 'closed' });
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  shadow.innerHTML = `
    <style>
      :host{all:initial;color-scheme:light dark;font:13px/1.4 system-ui,sans-serif;--canvas:light-dark(#f4f5f7,#0d0d0f);--paper:light-dark(#fff,#18181b);--ink:light-dark(#26282e,#e7e7ec);--muted:light-dark(#7c808c,#94949f);--line:light-dark(#e3e5eb,#29292e);--accent:light-dark(#485c8a,#babacb);--accent-soft:light-dark(#e9edf7,#24242b}
      :host([data-theme="light"]){color-scheme:light;--paper:#fff;--ink:#26282e;--muted:#7c808c;--line:#e3e5eb;--accent:#485c8a;--accent-soft:#e9edf7}
      :host([data-theme="dark"]){color-scheme:dark;--paper:#18181b;--ink:#e7e7ec;--muted:#94949f;--line:#29292e;--accent:#babacb;--accent-soft:#24242b}
      *{box-sizing:border-box}svg.wheel{display:block;width:300px;height:300px;overflow:visible;filter:drop-shadow(0 14px 32px #080a1535)}
      .slice{cursor:pointer;transform-origin:150px 150px;animation:slice-in 260ms cubic-bezier(.2,.8,.2,1) both}.slice:focus{outline:none}.slice path{fill:var(--paper);stroke:var(--line);stroke-width:1.5;transition:fill 130ms ease,stroke 130ms ease}.slice:hover path,.slice:focus path{fill:var(--accent);stroke:var(--accent)}.slice text{fill:var(--ink);pointer-events:none;text-anchor:middle;font-family:system-ui,sans-serif}.slice:hover text,.slice:focus text{fill:light-dark(#fff,#18181b)}.slice .name{font-size:10px;font-weight:650}.slice .hint{fill:var(--muted);font-size:6px;letter-spacing:.1em}.slice[aria-disabled="true"]{pointer-events:none;opacity:.6}
      .center{fill:var(--paper);stroke:var(--line);stroke-width:1.5}.brand-icon{rx:7}.domain{fill:var(--ink);font:650 9px system-ui,sans-serif;text-anchor:middle}.help,.status{fill:var(--muted);font:7px system-ui,sans-serif;letter-spacing:.1em;text-anchor:middle}.status{font-size:8px;letter-spacing:0}
      .close{position:absolute;top:17px;right:17px;display:grid;width:28px;height:28px;place-items:center;padding:0;border:1px solid var(--line);border-radius:50%;background:var(--paper);color:var(--ink);line-height:0;cursor:pointer;box-shadow:0 2px 12px #080a1520;transition:background 130ms ease,border-color 130ms ease,transform 130ms ease}.close svg{display:block;width:12px;height:12px;overflow:visible;pointer-events:none}.close path{fill:none;stroke:currentColor;stroke-linecap:round;stroke-width:1.7}.close:hover{border-color:var(--accent);background:var(--accent-soft)}.close:active{transform:scale(.94)}.close:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      @keyframes slice-in{from{opacity:0;scale:.88}to{opacity:1;scale:1}}
      @media(prefers-reduced-motion:reduce){.slice,.close{animation:none;transition:none}}
    </style>
    <svg class="wheel" viewBox="0 0 300 300" role="group" aria-label="Save to a folder">
      <g class="slices"></g><circle class="center" cx="150" cy="150" r="56"/>
      <image class="brand-icon" href="${iconUrl}" x="135" y="118" width="30" height="30"/>
      <text class="domain" x="150" y="163"></text>
      <text class="help" x="150" y="178">CHOOSE FOLDER</text>
      <text class="status" x="150" y="193"></text>
    </svg>
    <button class="close" type="button" aria-label="Close save picker"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg></button>`;

  const close = () => {
    host.remove();
    document.removeEventListener('keydown', escape);
  };
  const escape = (event) => {
    if (event.key === 'Escape') close();
  };
  shadow.querySelector('.close').addEventListener('click', close);
  host.addEventListener('click', (event) => event.stopPropagation());
  document.documentElement.append(host);
  document.addEventListener('keydown', escape);

  chrome.storage.local.get(['pendingCapture', 'folders', 'theme', 'wheelFolders']).then(({ pendingCapture, folders = [], theme, wheelFolders }) => {
    if (theme === 'light' || theme === 'dark') host.dataset.theme = theme;
    const text = pendingCapture || location.href;
    const parsed = (() => { try { return new URL(text); } catch { return null; } })();
    const domain = shadow.querySelector('.domain');
    const currentLabel = (parsed?.hostname || text).slice(0, 22);
    domain.textContent = currentLabel;
    const svg = 'http://www.w3.org/2000/svg';
    const polar = (radius, angle) => [150 + radius * Math.cos(angle), 150 + radius * Math.sin(angle)];
    const pointText = (pair) => `${pair[0].toFixed(2)} ${pair[1].toFixed(2)}`;
    const group = shadow.querySelector('.slices');
    const visibleIds = new Set(Array.isArray(wheelFolders) ? wheelFolders : folders.slice(0, 7).map(({ id }) => id));
    const visibleFolders = folders.filter(({ id }) => visibleIds.has(id)).slice(0, 7);
    const choices = [...visibleFolders, { id: '', name: 'No folder' }];
    const centerStatus = shadow.querySelector('.status');

    for (const [index, folder] of choices.entries()) {
      const start = (index / choices.length) * Math.PI * 2 - Math.PI / 2 + 0.025;
      const end = ((index + 1) / choices.length) * Math.PI * 2 - Math.PI / 2 - 0.025;
      const large = end - start > Math.PI ? 1 : 0;
      const path = document.createElementNS(svg, 'path');
      path.setAttribute('d', `M ${pointText(polar(148, start))} A 148 148 0 ${large} 1 ${pointText(polar(148, end))} L ${pointText(polar(58, end))} A 58 58 0 ${large} 0 ${pointText(polar(58, start))} Z`);
      const slice = document.createElementNS(svg, 'g');
      slice.classList.add('slice');
      slice.setAttribute('role', 'button');
      slice.setAttribute('tabindex', '0');
      slice.setAttribute('aria-label', `Save to ${folder.name}`);
      slice.style.animationDelay = `${index * 24}ms`;
      slice.append(path);
      const angle = (start + end) / 2;
      const [labelX, labelY] = polar(106, angle);
      const label = document.createElementNS(svg, 'text');
      label.classList.add('name');
      label.setAttribute('x', labelX.toFixed(2));
      label.setAttribute('y', (labelY + 3).toFixed(2));
      label.textContent = folder.name.slice(0, 16);
      const hint = document.createElementNS(svg, 'text');
      hint.classList.add('hint');
      hint.setAttribute('x', labelX.toFixed(2));
      hint.setAttribute('y', (labelY + 14).toFixed(2));
      hint.textContent = folder.id ? 'TAP TO SAVE' : 'UNFILED';
      slice.append(label, hint);
      slice.addEventListener('mouseenter', () => { domain.textContent = folder.name.slice(0, 22); });
      slice.addEventListener('mouseleave', () => { domain.textContent = currentLabel; });
      const save = async () => {
        if (slice.getAttribute('aria-disabled') === 'true') return;
        slice.setAttribute('aria-disabled', 'true');
        centerStatus.textContent = `Saving to ${folder.name}…`;
        try {
          const response = await chrome.runtime.sendMessage({ type: 'anything:save', text, folderId: folder.id || null });
          centerStatus.textContent = response?.ok ? `Saved to ${folder.name}` : response?.error || 'Could not save this item.';
          if (response?.ok) setTimeout(close, 850);
          else slice.removeAttribute('aria-disabled');
        } catch (error) {
          centerStatus.textContent = error.message;
          slice.removeAttribute('aria-disabled');
        }
      };
      slice.addEventListener('click', save);
      slice.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void save();
        }
      });
      group.append(slice);
    }
  }).catch(() => close());
})();
