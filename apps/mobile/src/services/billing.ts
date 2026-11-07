import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { auth } from './auth';
import { billingKey } from '../utils/billing-config';

export const REVENUECAT_TEST_MODE =
  __DEV__ && !!process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY?.startsWith('test_');

// Serialize identity changes: a purchase must belong to the signed-in Firebase account.
let identity = Promise.resolve();
export async function billingClient() {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Sign in before subscribing or restoring purchases.');
  if (Constants.appOwnership === 'expo' || !['ios', 'android'].includes(Platform.OS))
    throw new Error('Subscriptions are available in the installed Android or iOS app.');
  const apiKey = billingKey(Platform.OS, __DEV__, {
    test: process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY,
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  });
  if (!NativeModules.RNPurchases)
    throw new Error(
      'Update the app to use subscriptions. Your current build does not include purchases yet.',
    );
  const { default: Purchases } = await import('react-native-purchases');
  const next = identity
    .catch(() => {})
    .then(async () => {
      if (auth?.currentUser?.uid !== uid)
        throw new Error('Your account changed. Please try again.');
      if (!(await Purchases.isConfigured())) {
        await Purchases.setLogLevel(
          __DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.ERROR,
        );
        Purchases.configure({ apiKey, appUserID: uid });
      } else if ((await Purchases.getAppUserID()) !== uid) await Purchases.logIn(uid);
    });
  identity = next;
  await next;
  if (auth?.currentUser?.uid !== uid) throw new Error('Your account changed. Please try again.');
  return Purchases;
}
