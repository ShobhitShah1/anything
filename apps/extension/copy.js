(() => {
  if (window.__anythingCopyInstalled) return;
  window.__anythingCopyInstalled = true;
  const send = (message) => {
    try {
      chrome.runtime.sendMessage(message).catch(() => {});
    } catch {
      // Chrome can invalidate an old content-script context during extension reload.
    }
  };
  if (!window.__anythingPointerInstalled) {
    window.__anythingPointerInstalled = true;
    const rememberPointer = (event) => {
      window.__anythingContextPoint = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener('pointermove', rememberPointer, { capture: true, passive: true });
    document.addEventListener('contextmenu', rememberPointer, true);
  }
  let enabled = false;
  chrome.storage.local.get('copyEnabled').then((settings) => {
    enabled = !!settings.copyEnabled;
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.copyEnabled) enabled = !!changes.copyEnabled.newValue;
  });
  document.addEventListener(
    'copy',
    (event) => {
      if (!enabled || !event.isTrusted || document.activeElement?.matches('input[type="password"]'))
        return;
      const field = document.activeElement;
      const selected =
        event.clipboardData?.getData('text/plain') ||
        (typeof field?.selectionStart === 'number' && typeof field.value === 'string'
          ? field.value.slice(field.selectionStart, field.selectionEnd)
          : window.getSelection()?.toString()) ||
        '';
      setTimeout(async () => {
        if (!enabled) return;
        let text = selected;
        try {
          text = (await navigator.clipboard?.readText()) || selected;
        } catch {
          /* Selection capture also works on pages without Clipboard API access. */
        }
        if (text.trim()) send({ type: 'anything:copied', text });
      }, 0);
    },
    true,
  );
})();
