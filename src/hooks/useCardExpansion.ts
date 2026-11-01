import { useLayoutEffect, useRef, type RefObject } from 'react';
import { usePresence, useReducedMotion } from 'framer-motion';

// Native dialogs live in the browser's top layer. Project viewport rectangles
// directly, so opening and returning use the same coordinates even after scrolling.
export function useCardExpansion(ref: RefObject<HTMLElement | null>, id: string | undefined, sourceAttribute = 'data-card-id') {
  const [present, safeToRemove] = usePresence();
  const reduceMotion = useReducedMotion();
  const animation = useRef<Animation | null>(null);
  const liftedSource = useRef<{ element: HTMLElement; visibility: string } | null>(null);
  const snapshot = useRef<HTMLElement | null>(null);
  const snapshotAnimation = useRef<Animation | null>(null);
  const finishExit = useRef(safeToRemove);
  useLayoutEffect(() => { finishExit.current = safeToRemove; }, [safeToRemove]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const source = id ? [...document.querySelectorAll<HTMLElement>(`[${sourceAttribute}="${CSS.escape(id)}"]`)].findLast(candidate => candidate !== element) : null;
    const style = getComputedStyle(element);
    const current = { transform: style.transform, opacity: style.opacity };
    const presentation = element.getBoundingClientRect();
    const snapshotOpacity = snapshot.current ? getComputedStyle(snapshot.current).opacity : present ? 1 : 0;
    const previous = animation.current;
    previous?.cancel();
    snapshotAnimation.current?.cancel();
    snapshot.current?.remove();
    const target = element.getBoundingClientRect();
    const origin = source?.getBoundingClientRect();
    if (source && liftedSource.current?.element !== source) {
      if (liftedSource.current) liftedSource.current.element.style.visibility = liftedSource.current.visibility;
      liftedSource.current = { element: source, visibility: source.style.visibility };
      source.style.visibility = 'hidden';
    }
    const transform = !reduceMotion && origin && target.width && target.height
      ? `translate(${origin.left - target.left}px, ${origin.top - target.top}px) scale(${origin.width / target.width}, ${origin.height / target.height})`
      : 'none';
    const shared = Boolean(origin) && !reduceMotion;
    const timing: KeyframeAnimationOptions = {
      duration: reduceMotion ? 120 : 360,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      fill: 'both',
    };
    const dialog = element.closest('dialog');
    const blend = shared && source && dialog && dialog !== element;
    if (blend && origin) {
      // Carry the real card's appearance through the handoff instead of snapping
      // between stretched detail text and the smaller grid preview.
      const clone = source.cloneNode(true) as HTMLElement;
      clone.inert = true;
      clone.setAttribute('aria-hidden', 'true');
      for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('[id], [data-card-id], [data-image-id]')]) {
        node.removeAttribute('id');
        node.removeAttribute('data-card-id');
        node.removeAttribute('data-image-id');
      }
      Object.assign(clone.style, {
        position: 'fixed', left: `${origin.left}px`, top: `${origin.top}px`,
        width: `${origin.width}px`, height: `${origin.height}px`, margin: '0',
        maxWidth: 'none', maxHeight: 'none', zIndex: '20', pointerEvents: 'none',
        visibility: 'visible', transformOrigin: '0 0', overflow: 'hidden',
      });
      dialog.appendChild(clone);
      snapshot.current = clone;
      const project = (box: DOMRect) => `translate(${box.left - origin.left}px, ${box.top - origin.top}px) scale(${box.width / origin.width}, ${box.height / origin.height})`;
      snapshotAnimation.current = clone.animate(present ? [
        { transform: previous ? project(presentation) : 'none', opacity: snapshotOpacity },
        { transform: project(target), opacity: 0 },
      ] : [
        { transform: project(presentation), opacity: snapshotOpacity },
        { transform: 'none', opacity: 1 },
      ], timing);
    }
    animation.current = element.animate(present
      ? [previous ? current : { transform, opacity: blend || !shared ? 0 : 1 }, { transform: 'none', opacity: 1 }]
      : [current, { transform, opacity: blend || !shared ? 0 : 1 }], timing);
    void animation.current.finished.then(() => {
      if (present) {
        snapshot.current?.remove();
        snapshot.current = null;
      } else {
        // Presence waits for the actual native animation, not a competing timer.
        finishExit.current?.();
      }
    }).catch(() => { /* A new interaction retargets the in-flight animation. */ });
  }, [id, present, reduceMotion, ref, sourceAttribute]);
  useLayoutEffect(() => () => {
    animation.current?.cancel();
    snapshotAnimation.current?.cancel();
    snapshot.current?.remove();
    if (liftedSource.current) liftedSource.current.element.style.visibility = liftedSource.current.visibility;
    animation.current = null;
    liftedSource.current = null;
    snapshot.current = null;
  }, []);
}
