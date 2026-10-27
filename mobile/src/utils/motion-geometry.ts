export interface MediaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function crossesViewport(
  fromY: number,
  fromHeight: number,
  toY: number,
  toHeight: number,
  viewportHeight: number,
) {
  'worklet';
  return Math.min(fromY, toY) < viewportHeight && Math.max(fromY + fromHeight, toY + toHeight) > 0;
}

export function containedMedia(width: number, height: number, ratio: number): MediaRect {
  if (width <= 0 || height <= 0 || !Number.isFinite(ratio) || ratio <= 0)
    return { x: 0, y: 0, width: 0, height: 0 };
  const fittedWidth = Math.min(width, height * ratio);
  const fittedHeight = fittedWidth / ratio;
  return {
    x: (width - fittedWidth) / 2,
    y: (height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}
