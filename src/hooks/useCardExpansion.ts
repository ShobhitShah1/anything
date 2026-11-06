import { useLayoutEffect, useRef, type RefObject } from 'react';
import { usePresence, useReducedMotion } from 'framer-motion';

// Native dialogs live in the browser's top layer. Project viewport rectangles
// directly, so opening and returning use the same coordinates even after scrolling.
export function useCardExpansion(
  ref: RefObject<HTMLElement | null>,
  id: string | undefined,
  sourceAttribute = 'data-card-id',
  cropToSource = false,
) {
  const [present, safeToRemove] = usePresence();
  const reduceMotion = useReducedMotion();
  const animation = useRef<Animation | null>(null);
  const liftedSource = useRef<{ element: HTMLElement; visibility: string } | null>(null);
  const snapshot = useRef<HTMLElement | null>(null);
  const snapshotAnimation = useRef<Animation | null>(null);
  const contentAnimation = useRef<Animation | null>(null);
  const backdropAnimation = useRef<Animation | null>(null);
  const sourceAnimation = useRef<Animation | null>(null);
  const cycle = useRef(0);
  const finishExit = useRef(safeToRemove);
  useLayoutEffect(() => {
    finishExit.current = safeToRemove;
  }, [safeToRemove]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const revision = ++cycle.current;
    const source = id
      ? [
          ...document.querySelectorAll<HTMLElement>(`[${sourceAttribute}="${CSS.escape(id)}"]`),
        ].findLast(
          (candidate) => candidate !== element && !candidate.closest('[data-expansion-snapshot]'),
        )
      : null;
    const style = getComputedStyle(element);
    const current = {
      transform: style.transform,
      opacity: style.opacity,
      clipPath: style.clipPath,
    };
    const editor = cropToSource ? element.querySelector<HTMLElement>('.capture-editor') : null;
    const editorOpacity = editor ? getComputedStyle(editor).opacity : '1';
    const editorClip = editor ? getComputedStyle(editor).clipPath : 'none';
    const backdrop = cropToSource
      ? element.closest('dialog')?.querySelector<HTMLElement>('.capture-backdrop')
      : null;
    const backdropOpacity = backdrop ? getComputedStyle(backdrop).opacity : '1';
    const presentation = element.getBoundingClientRect();
    const snapshotOpacity = snapshot.current
      ? getComputedStyle(snapshot.current).opacity
      : present
        ? 1
        : 0;
    const previous = animation.current;
    const sourceOpacity = source ? getComputedStyle(source).opacity : '1';
    previous?.cancel();
    contentAnimation.current?.cancel();
    backdropAnimation.current?.cancel();
    sourceAnimation.current?.cancel();
    snapshotAnimation.current?.cancel();
    snapshot.current?.remove();
    const target = element.getBoundingClientRect();
    const origin = source?.getBoundingClientRect();
    if (source && liftedSource.current?.element !== source) {
      if (liftedSource.current)
        liftedSource.current.element.style.visibility = liftedSource.current.visibility;
      liftedSource.current = { element: source, visibility: source.style.visibility };
      source.style.visibility = 'hidden';
    }
    const shared = Boolean(origin && origin.width > 0 && origin.height > 0) && !reduceMotion;
    const cropInset =
      cropToSource && shared && origin && target.width
        ? Math.max(0, target.height - (origin.height * target.width) / origin.width) / 2
        : 0;
    const transform =
      !reduceMotion &&
      origin &&
      origin.width > 0 &&
      origin.height > 0 &&
      target.width &&
      target.height
        ? `translate(${origin.left - target.left}px, ${origin.top - target.top - (cropInset * origin.width) / target.width}px) scale(${origin.width / target.width}, ${cropToSource ? origin.width / target.width : origin.height / target.height})`
        : 'none';
    // Fold around the center so the visible surface follows a straight path to the dock.
    const sourceStyle = source ? getComputedStyle(source) : null;
    const crop =
      cropToSource && shared && origin && source && target.width
        ? `inset(${cropInset}px 0px ${cropInset}px 0px round ${(['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'] as const).map((key) => (parseFloat(sourceStyle![key]) * target.width) / origin.width + 'px').join(' ')})`
        : 'none';
    const expandedCrop =
      cropToSource && shared ? `inset(0px 0px 0px 0px round ${style.borderRadius})` : 'none';
    const timing: KeyframeAnimationOptions = {
      duration: reduceMotion ? 120 : cropToSource ? (present ? 420 : 300) : 360,
      easing: cropToSource
        ? present
          ? 'cubic-bezier(0.77, 0, 0.175, 1)'
          : 'cubic-bezier(0.23, 1, 0.32, 1)'
        : 'cubic-bezier(0.32, 0.72, 0, 1)',
      fill: 'both',
    };
    const dialog = element.closest('dialog');
    if (cropToSource) {
      if (backdrop) {
        backdropAnimation.current = backdrop.animate(
          [{ opacity: present && !previous ? 0 : backdropOpacity }, { opacity: present ? 1 : 0 }],
          present ? { ...timing, duration: reduceMotion ? 120 : 200 } : timing,
        );
      }
      // One opaque surface grows from the real dock. Never scale a blurred clone.
      if (editor) {
        contentAnimation.current = editor.animate(
          present
            ? [{ opacity: previous ? editorOpacity : 0 }, { opacity: 1 }]
            : [
                {
                  opacity: editorOpacity,
                  clipPath: editorClip === 'none' ? 'inset(0% 0% 0% 0%)' : editorClip,
                },
                {
                  opacity: shared ? editorOpacity : 0,
                  clipPath: shared ? 'inset(50% 0% 50% 0%)' : 'none',
                },
              ],
          present
            ? { duration: reduceMotion ? 100 : 180, delay: reduceMotion ? 0 : 60, fill: 'both' }
            : timing,
        );
      }
      if (shared && source && liftedSource.current) {
        if (present) {
          source.style.visibility = liftedSource.current.visibility;
          sourceAnimation.current = source.animate(
            [{ opacity: previous ? sourceOpacity : 1 }, { opacity: 0 }],
            { duration: 100, fill: 'both' },
          );
          void sourceAnimation.current.finished
            .then(() => {
              if (cycle.current === revision) source.style.visibility = 'hidden';
            })
            .catch(() => {});
        } else {
          source.style.visibility = 'hidden';
        }
      }
      animation.current = element.animate(
        present
          ? [
              previous ? current : { transform, opacity: shared ? 1 : 0, clipPath: crop },
              { transform: 'none', opacity: 1, clipPath: expandedCrop },
            ]
          : [current, { transform, opacity: shared ? current.opacity : 0, clipPath: crop }],
        timing,
      );
      void animation.current.finished
        .then(() => {
          if (cycle.current === revision && !present) {
            // Hide before React cancels the filled transform during unmount.
            element.style.visibility = 'hidden';
            sourceAnimation.current?.cancel();
            if (liftedSource.current)
              liftedSource.current.element.style.visibility = liftedSource.current.visibility;
            finishExit.current?.();
          }
        })
        .catch(() => {});
      return;
    }
    const blend = shared && source && dialog && dialog !== element;
    if (blend && origin) {
      // Carry the real card's appearance through the handoff instead of snapping
      // between stretched detail text and the smaller grid preview.
      const clone = source.cloneNode(true) as HTMLElement;
      clone.inert = true;
      clone.dataset.expansionSnapshot = '';
      clone.setAttribute('aria-hidden', 'true');
      for (const node of [
        clone,
        ...clone.querySelectorAll<HTMLElement>('[id], [data-card-id], [data-image-id]'),
      ]) {
        node.removeAttribute('id');
        node.removeAttribute('data-card-id');
        node.removeAttribute('data-image-id');
        node.removeAttribute(sourceAttribute);
      }
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${origin.left}px`,
        top: `${origin.top}px`,
        width: `${origin.width}px`,
        height: `${origin.height}px`,
        margin: '0',
        maxWidth: 'none',
        maxHeight: 'none',
        zIndex: '20',
        pointerEvents: 'none',
        visibility: 'visible',
        transformOrigin: '0 0',
        overflow: 'hidden',
      });
      dialog.appendChild(clone);
      snapshot.current = clone;
      const project = (box: DOMRect) =>
        `translate(${box.left - origin.left}px, ${box.top - origin.top}px) scale(${box.width / origin.width}, ${cropToSource ? box.width / origin.width : box.height / origin.height})`;
      snapshotAnimation.current = clone.animate(
        present
          ? [
              { transform: previous ? project(presentation) : 'none', opacity: snapshotOpacity },
              { transform: project(target), opacity: 0 },
            ]
          : [
              { transform: project(presentation), opacity: snapshotOpacity },
              { transform: 'none', opacity: 1 },
            ],
        timing,
      );
    }
    animation.current = element.animate(
      present
        ? [
            previous ? current : { transform, opacity: blend || !shared ? 0 : 1, clipPath: crop },
            { transform: 'none', opacity: 1, clipPath: expandedCrop },
          ]
        : [current, { transform, opacity: blend || !shared ? 0 : 1, clipPath: crop }],
      timing,
    );
    void animation.current.finished
      .then(() => {
        if (cycle.current !== revision) return;
        if (present) {
          snapshot.current?.remove();
          snapshot.current = null;
        } else {
          // Presence waits for the actual native animation, not a competing timer.
          finishExit.current?.();
        }
      })
      .catch(() => {
        /* A new interaction retargets the in-flight animation. */
      });
  }, [id, present, reduceMotion, ref, sourceAttribute, cropToSource]);
  useLayoutEffect(
    () => () => {
      cycle.current++;
      animation.current?.cancel();
      snapshotAnimation.current?.cancel();
      contentAnimation.current?.cancel();
      backdropAnimation.current?.cancel();
      sourceAnimation.current?.cancel();
      snapshot.current?.remove();
      if (liftedSource.current)
        liftedSource.current.element.style.visibility = liftedSource.current.visibility;
      animation.current = null;
      liftedSource.current = null;
      snapshot.current = null;
    },
    [],
  );
}
