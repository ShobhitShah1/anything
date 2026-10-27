export type CardRect = { x: number; y: number; width: number; height: number };

export function contextGeometry(
  source: CardRect,
  width: number,
  height: number,
  top: number,
  bottom: number,
  desiredMenuHeight = 348,
) {
  const menuHeight = Math.min(desiredMenuHeight, Math.max(44, height - top - bottom - 96));
  const available = Math.max(48, height - top - bottom - menuHeight - 48);
  const scale = Math.min(1.05, (width - 48) / source.width, available / source.height);
  const previewHeight = source.height * scale;
  const y = top + 16 + Math.max(0, (available - previewHeight) / 2);
  return {
    x: (width - source.width * scale) / 2,
    y,
    scale,
    menuY: y + previewHeight + 12,
    menuHeight,
    menuWidth: Math.min(320, width - 48),
  };
}
