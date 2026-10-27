export function captureFrame(
  panelHeight: number,
  keyboardHeight: number,
  bottomInset: number,
  keyboardProgress: number,
  expanded: boolean,
  scrollOffset: number,
) {
  'worklet';
  return {
    height: Math.max(58, panelHeight + (expanded ? keyboardHeight : 0)),
    paddingBottom: bottomInset * (1 - keyboardProgress),
    translateY: keyboardHeight + scrollOffset,
  };
}
