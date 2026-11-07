import type { CustomerInfo } from 'react-native-purchases';

export const ENTITLEMENT_ID = 'anything_pro';

export function hasPro(info: CustomerInfo) {
  return info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
}

export function billingError(error: unknown) {
  const value = error as { code?: string; userCancelled?: boolean; message?: string } | null;
  if (value?.userCancelled || value?.code === '1') return '';
  if (value?.code === '20')
    return 'Payment is pending approval. Access will update after it is confirmed; do not purchase again.';
  return value?.message || 'Could not complete this purchase. Please try again.';
}

export function billingKey(
  platform: string,
  development: boolean,
  keys: { test?: string; ios?: string; android?: string },
) {
  if (development && keys.test?.startsWith('test_')) return keys.test;
  const key = platform === 'ios' ? keys.ios : platform === 'android' ? keys.android : '';
  if (!key || !key.startsWith(platform === 'ios' ? 'appl_' : 'goog_'))
    throw new Error('Subscriptions are not configured for this build. Please try again later.');
  return key;
}
