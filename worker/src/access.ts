export const freeLimit = 3;
export const paidLimit = 100;
export const entitlementId = "anything_pro";

export class AccessError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 403) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type Usage = {
  freeUsed?: number;
  month?: string;
  paidUsed?: number;
  pending?: { id: string; until: number } | null;
};

export function allowance(usage: Usage, paid: boolean, now: number) {
  const month = new Date(now).toISOString().slice(0, 7);
  const used = paid
    ? usage.month === month
      ? usage.paidUsed || 0
      : 0
    : usage.freeUsed || 0;
  const limit = paid ? paidLimit : freeLimit;
  return { paid, used, limit, remaining: Math.max(0, limit - used), month };
}

export function reserve(
  usage: Usage,
  paid: boolean,
  id: string,
  now: number,
): Usage {
  if (usage.pending && usage.pending.until > now)
    throw new AccessError(
      "busy",
      "An AI response is already being created. Please wait.",
      409,
    );
  const access = allowance(usage, paid, now);
  if (!access.remaining)
    throw new AccessError(
      paid ? "monthly_limit" : "subscription_required",
      paid
        ? "Your 100 monthly AI responses are used. More arrive next calendar month."
        : "Your three free AI responses are used. Continue with Anything Pro.",
      402,
    );
  return { ...usage, pending: { id, until: now + 180_000 } };
}

export function finish(
  usage: Usage,
  paid: boolean,
  id: string,
  startedAt: number,
  success: boolean,
): Usage {
  if (usage.pending?.id !== id) return usage;
  const access = allowance(usage, paid, startedAt);
  return {
    ...usage,
    pending: null,
    ...(success
      ? paid
        ? { month: access.month, paidUsed: access.used + 1 }
        : { freeUsed: access.used + 1 }
      : {}),
  };
}

export function hasEntitlement(
  subscriber: unknown,
  now: number,
  allowSandbox = false,
) {
  if (!subscriber || typeof subscriber !== "object") return false;
  const value = subscriber as {
    entitlements?: Record<
      string,
      {
        expires_date?: string | null;
        grace_period_expires_date?: string | null;
        product_identifier?: string;
      }
    >;
    subscriptions?: Record<string, { is_sandbox?: boolean }>;
  };
  const entitlement = value.entitlements?.[entitlementId];
  if (!entitlement) return false;
  if (
    !allowSandbox &&
    (!entitlement.product_identifier ||
      value.subscriptions?.[entitlement.product_identifier]?.is_sandbox !==
        false)
  )
    return false;
  if (entitlement.expires_date === null) return true;
  const expiry = Math.max(
    Date.parse(entitlement.expires_date || "") || 0,
    Date.parse(entitlement.grace_period_expires_date || "") || 0,
  );
  return expiry > now;
}
