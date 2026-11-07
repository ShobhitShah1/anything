export function imageRatio(width: number, height: number): number | undefined {
  const ratio = width / height;
  return width > 0 && height > 0 && Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}
