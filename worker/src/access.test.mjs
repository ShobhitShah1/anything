import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowance,
  reserve,
  finish,
  hasEntitlement,
  entitlementId,
} from "./access.ts";

const now = Date.parse("2026-10-25T10:00:00Z");
test("server and mobile use the requested anything_pro entitlement", () => {
  assert.equal(entitlementId, "anything_pro");
  assert.equal(
    hasEntitlement(
      { entitlements: { anything_plus: { expires_date: null } } },
      now,
      true,
    ),
    false,
  );
});
test("only three successful free responses, failures release the reservation", () => {
  let usage = {};
  usage = reserve(usage, false, "failed", now);
  usage = finish(usage, false, "failed", now, false);
  assert.equal(allowance(usage, false, now).remaining, 3);
  for (let i = 0; i < 3; i++) {
    usage = reserve(usage, false, String(i), now);
    assert.throws(() => reserve(usage, false, "parallel", now), {
      code: "busy",
    });
    usage = finish(usage, false, String(i), now, true);
    assert.equal(finish(usage, false, String(i), now, true), usage);
  }
  assert.throws(() => reserve(usage, false, "four", now), {
    code: "subscription_required",
  });
});
test("paid usage resets at the UTC month boundary without resetting free allowance", () => {
  const usage = { freeUsed: 3, month: "2026-10", paidUsed: 100 };
  assert.throws(() => reserve(usage, true, "full", now), {
    code: "monthly_limit",
  });
  const november = Date.parse("2026-11-01T00:00:00Z");
  const next = finish(
    reserve(usage, true, "next", november),
    true,
    "next",
    november,
    true,
  );
  assert.equal(next.paidUsed, 1);
  assert.equal(next.freeUsed, 3);
});
test("stale reservations cannot release or charge a newer request", () => {
  const first = reserve({}, false, "old", now);
  const next = reserve(first, false, "new", now + 180001);
  assert.equal(finish(next, false, "old", now, true), next);
});
test("entitlements reject expired, absent, malformed, and sandbox access in production", () => {
  const subscriber = (expires_date, is_sandbox = false, extra = {}) => ({
    entitlements: {
      anything_pro: { expires_date, product_identifier: "plus", ...extra },
    },
    subscriptions: { plus: { is_sandbox } },
  });
  assert.equal(hasEntitlement(null, now), false);
  assert.equal(hasEntitlement({}, now), false);
  assert.equal(hasEntitlement(subscriber("invalid"), now), false);
  assert.equal(hasEntitlement(subscriber("2026-10-24"), now), false);
  assert.equal(hasEntitlement(subscriber("2026-11-01"), now), true);
  assert.equal(hasEntitlement(subscriber("2026-11-01", true), now), false);
  assert.equal(hasEntitlement(subscriber("2026-11-01", true), now, true), true);
  assert.equal(
    hasEntitlement(
      subscriber("2026-10-24", false, {
        grace_period_expires_date: "2026-11-01",
      }),
      now,
    ),
    true,
  );
  assert.equal(hasEntitlement(subscriber(null), now), true);
});
