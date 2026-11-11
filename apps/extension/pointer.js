(() => {
  if (window.__anythingPointerInstalled) return;
  window.__anythingPointerInstalled = true;
  const remember = (event) => {
    window.__anythingContextPoint = { x: event.clientX, y: event.clientY };
  };
  document.addEventListener('pointermove', remember, { capture: true, passive: true });
  document.addEventListener('contextmenu', remember, true);
})();
