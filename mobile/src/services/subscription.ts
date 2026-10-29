import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { auth } from './auth';
import { getAiAccess, type AiAccess } from './ai';
import { billingClient } from './billing';
import { hasPro } from '../utils/billing-config';
import { subscriptionPlans } from '../utils/subscription-plans';

type Snapshot = {
  access: AiAccess | null;
  customer: CustomerInfo | null;
  plans: PurchasesPackage[];
};
let snapshot: { uid: string; value: Snapshot } | undefined;
let pending: { uid: string; promise: ReturnType<typeof fetchSubscription> } | undefined;

export function subscriptionSnapshot(uid?: string) {
  return uid && auth?.currentUser?.uid === uid && snapshot?.uid === uid
    ? snapshot.value
    : undefined;
}

export function rememberSubscription(uid: string, value: Snapshot) {
  if (auth?.currentUser?.uid === uid) snapshot = { uid, value };
}

async function fetchSubscription(uid: string) {
  const initial = snapshot;
  const results = await Promise.allSettled([
    getAiAccess(new AbortController().signal),
    billingClient().then(async (client) => {
      const [offerings, customer] = await Promise.all([
        client.getOfferings(),
        client.getCustomerInfo(),
      ]);
      return { offerings, customer, active: hasPro(customer) };
    }),
  ]);
  const [usage, billing] = results;
  const previous = subscriptionSnapshot(uid);
  if (snapshot === initial)
    rememberSubscription(uid, {
      access: usage.status === 'fulfilled' ? usage.value : (previous?.access ?? null),
      customer:
        billing.status === 'fulfilled' ? billing.value.customer : (previous?.customer ?? null),
      plans:
        billing.status === 'fulfilled'
          ? subscriptionPlans(billing.value.offerings.current?.availablePackages || []).map(
              (plan) => plan.storePackage,
            )
          : (previous?.plans ?? []),
    });
  return results;
}

export function loadSubscription(uid: string) {
  if (pending?.uid === uid) return pending.promise;
  const request = { uid, promise: fetchSubscription(uid) };
  pending = request;
  void request.promise.finally(() => {
    if (pending === request) pending = undefined;
  });
  return request.promise;
}
