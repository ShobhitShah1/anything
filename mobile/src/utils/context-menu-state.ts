export type ContextMenuPhase = 'loading' | 'open' | 'closing' | 'finished';

export function contextMenuPhase(
  phase: ContextMenuPhase,
  event: 'ready' | 'close' | 'finished',
): ContextMenuPhase {
  if (event === 'ready') return phase === 'loading' ? 'open' : phase;
  if (event === 'close') return phase === 'finished' ? phase : 'closing';
  return phase === 'closing' ? 'finished' : phase;
}
