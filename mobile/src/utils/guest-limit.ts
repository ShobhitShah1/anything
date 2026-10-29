export const GUEST_ITEM_LIMIT = 10;

export function guestLimitReached(
  previous: readonly { id: string }[],
  next: readonly { id: string }[],
  signedIn: boolean,
) {
  if (signedIn || next.length <= GUEST_ITEM_LIMIT) return false;
  const existing = new Set(previous.map((item) => item.id));
  return next.some((item) => !existing.has(item.id));
}

export class GuestLimitError extends Error {
  constructor() {
    super('Sign in to save more than 10 finds. Your draft is still here.');
  }
}
