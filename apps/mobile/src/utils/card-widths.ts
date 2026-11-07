export function cardWidths(columnWidth: number, list: boolean, hasImage: boolean) {
  const width = Math.max(0, columnWidth - 12);
  return {
    width,
    contentWidth: Math.max(0, width - (list ? (hasImage ? 120 : 32) : 0)),
  };
}
