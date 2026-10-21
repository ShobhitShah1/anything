export function packMasonry(heights: number[], columns: number, gap: number) {
  const bottoms = Array<number>(columns).fill(0);
  const positions = heights.map(height => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const top = bottoms[column];
    bottoms[column] += height + gap;
    return { top, column };
  });
  return { positions, height: heights.length ? Math.max(...bottoms) - gap : 0 };
}
