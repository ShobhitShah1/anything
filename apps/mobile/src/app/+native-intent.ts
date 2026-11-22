export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (
    path &&
    (path.includes('dataUrl=') ||
      path.includes('expo-sharing') ||
      path.startsWith('file://') ||
      path.includes('share'))
  ) {
    return '/';
  }

  return path;
}
