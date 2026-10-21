(() => {
  if (window.__anythingBridgeInstalled) return;
  window.__anythingBridgeInstalled = true;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message.type !== 'anything:deliver' || !Array.isArray(message.entries)) return;
    const allowed = new Set(message.entries.map(entry => entry.id));
    let timer;
    const finish = savedIds => { clearTimeout(timer); window.removeEventListener('message', receive); respond({ savedIds }); };
    const receive = event => {
      if (event.source === window && event.origin === location.origin && event.data?.source === 'anything-app' && Array.isArray(event.data.savedIds)) finish(event.data.savedIds.filter(id => allowed.has(id)));
    };
    window.addEventListener('message', receive);
    timer = setTimeout(() => finish([]), 5000);
    window.postMessage({ source: 'anything-extension', entries: message.entries }, location.origin);
    return true;
  });
  chrome.runtime.sendMessage({ type: 'anything:ready' }).catch(() => {});
})();
