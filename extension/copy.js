(() => {
  if (window.__anythingCopyInstalled) return;
  window.__anythingCopyInstalled = true;
  let enabled = false;
  chrome.storage.local.get('copyEnabled').then(settings => { enabled = !!settings.copyEnabled; });
  chrome.storage.onChanged.addListener(changes => { if (changes.copyEnabled) enabled = !!changes.copyEnabled.newValue; });
  document.addEventListener('copy', event => {
    if (!enabled || !event.isTrusted || document.activeElement?.matches('input[type="password"]')) return;
    const field = document.activeElement;
    const selected = event.clipboardData?.getData('text/plain') || (typeof field?.selectionStart === 'number' && typeof field.value === 'string' ? field.value.slice(field.selectionStart, field.selectionEnd) : window.getSelection()?.toString()) || '';
    setTimeout(async () => {
      if (!enabled) return;
      let text = selected;
      try { text = await navigator.clipboard?.readText() || selected; } catch { /* Selection capture also works on pages without Clipboard API access. */ }
      if (text.trim()) chrome.runtime.sendMessage({ type: 'anything:copied', text }).catch(() => {});
    }, 0);
  }, true);
})();
