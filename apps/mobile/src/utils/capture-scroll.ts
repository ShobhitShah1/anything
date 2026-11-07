export interface CaptureScroll {
  offset: number;
  travel: number;
  hidden: boolean;
}

export function captureScroll(
  previous: CaptureScroll,
  offset: number,
  maxOffset: number,
): CaptureScroll {
  const y = Math.max(0, Math.min(offset, Math.max(0, maxOffset)));
  const delta = y - previous.offset;
  const travel = Math.max(
    -12,
    Math.min(12, Math.sign(delta) === Math.sign(previous.travel) ? previous.travel + delta : delta),
  );
  return {
    offset: y,
    travel: delta === 0 ? previous.travel : travel,
    hidden: y <= 8 ? false : Math.abs(travel) >= 12 ? travel > 0 : previous.hidden,
  };
}
