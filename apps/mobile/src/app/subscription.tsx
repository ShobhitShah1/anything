import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../services/auth';
import {
  ActivityIndicator,
  AppState,
  Image,
  useWindowDimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { X } from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { GoogleMark } from '../components/ui';
import { getAiAccess, type AiAccess } from '../services/ai';
import { billingClient, REVENUECAT_TEST_MODE } from '../services/billing';
import { billingError, ENTITLEMENT_ID, hasPro } from '../utils/billing-config';
import { openLink } from '../utils/open-link';
import { subscriptionPlans } from '../utils/subscription-plans';
import { MembershipBackdrop } from '../components/membership-backdrop';
import { fonts } from '../theme';
import { verifySubscription } from '../utils/verify-subscription';
import {
  loadSubscription,
  rememberSubscription,
  subscriptionSnapshot,
} from '../services/subscription';

const terms =
  process.env.EXPO_PUBLIC_TERMS_URL || 'https://shobhitshah1.github.io/anything/about/terms.html';
const privacy =
  process.env.EXPO_PUBLIC_PRIVACY_URL ||
  'https://shobhitshah1.github.io/anything/about/privacy.html';

export default function Subscription() {
  const { user } = useCollection();
  return <Membership key={user?.uid || 'guest'} />;
}

function Membership() {
  const state = useCollection();
  const { user } = state;
  // The Pro screen uses the About site's nocturnal palette in either app theme.
  const colors = {
    ...state.colors,
    canvas: '#10120F',
    paper: '#191C17',
    ink: '#F1EFE3',
    muted: '#A9ACA1',
    line: '#383D32',
    soft: '#292F23',
    accent: '#E2E8CC',
    aiBlue: '#CEDBB2',
  };
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const artWidth = Math.max(380, screenWidth);
  const cached = subscriptionSnapshot(user?.uid);
  const [access, setAccess] = useState<AiAccess | null>(cached?.access ?? null);
  const [plans, setPlans] = useState<PurchasesPackage[]>(cached?.plans ?? []);
  const [customer, setCustomer] = useState<CustomerInfo | null>(cached?.customer ?? null);
  const storeActive = !!customer && hasPro(customer);
  const [selected, setSelected] = useState(cached?.plans[0]?.identifier || '');
  const [loading, setLoading] = useState(!!user && !cached);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<'approval' | 'verification' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(false);
  const focusController = useRef<AbortController | null>(null);
  const refreshVersion = useRef(0);
  useEffect(() => {
    if (user) rememberSubscription(user.uid, { access, customer, plans });
  }, [user, access, customer, plans]);

  const refresh = useCallback(
    async (signal: AbortSignal) => {
      if (!user) return;
      const version = ++refreshVersion.current;
      const cached = subscriptionSnapshot(user.uid);
      setLoading(!cached?.access || (!cached.customer && !cached.plans.length));
      setError('');
      setNotice('');
      const results = await loadSubscription(user.uid);
      if (
        signal.aborted ||
        version !== refreshVersion.current ||
        auth?.currentUser?.uid !== user.uid
      )
        return;
      const [usage, offerings] = results;
      if (usage.status === 'fulfilled') setAccess(usage.value);
      if (
        usage.status === 'fulfilled' &&
        !usage.value.paid &&
        offerings.status === 'fulfilled' &&
        offerings.value.active
      )
        setNotice(
          'A store subscription was found. Server access is still being verified; refresh or restore in a moment.',
        );
      const messages: string[] = [];
      if (usage.status === 'rejected')
        messages.push(
          usage.reason instanceof Error ? usage.reason.message : 'Could not load AI usage.',
        );
      if (offerings.status === 'fulfilled') {
        const current = offerings.value.offerings.current;
        setCustomer(offerings.value.customer);
        if (offerings.value.active) setPending(null);
        const available = subscriptionPlans(current?.availablePackages || []).map(
          (plan) => plan.storePackage,
        );
        if (__DEV__)
          console.info('[billing] Offerings response', {
            currentOffering: current?.identifier ?? null,
            offerings: Object.values(offerings.value.offerings.all).map((offering) => ({
              id: offering.identifier,
              packages: offering.availablePackages.map((pkg) => ({
                packageId: pkg.identifier,
                productId: pkg.product.identifier,
                title: pkg.product.title,
                period: pkg.product.subscriptionPeriod,
                price: pkg.product.price,
                priceString: pkg.product.priceString,
                currency: pkg.product.currencyCode,
              })),
            })),
            displayedPackages: available.map((pkg) => pkg.identifier),
          });
        setPlans(available);
        setSelected((value) =>
          available.some((plan) => plan.identifier === value)
            ? value
            : available[0]?.identifier || '',
        );
        if (
          !available.length &&
          !offerings.value.active &&
          !(usage.status === 'fulfilled' && usage.value.paid)
        )
          messages.push(
            'Plans are not available from the store yet. You can still use any free AI responses.',
          );
      } else {
        if (__DEV__)
          console.warn('[billing] Offerings request failed', {
            code: offerings.reason?.code,
            message: offerings.reason?.message,
          });
        messages.push(offerings.reason?.message || 'Could not load subscription plans.');
      }
      setError(messages.join('\n'));
      setLoading(false);
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      focusController.current = controller;
      setNotice('');
      setError('');
      void refresh(controller.signal);
      const subscription = AppState.addEventListener('change', (value) => {
        if (value === 'active' && !operation.current) void refresh(controller.signal);
      });
      let listeningClient: Awaited<ReturnType<typeof billingClient>> | undefined;
      const onCustomerInfo = (info: CustomerInfo) => {
        if (controller.signal.aborted || auth?.currentUser?.uid !== user?.uid) return;
        setCustomer(info);
        if (hasPro(info)) setPending(null);
        if (!operation.current)
          void getAiAccess(controller.signal)
            .then((result) => {
              if (!controller.signal.aborted && auth?.currentUser?.uid === user?.uid)
                setAccess(result);
            })
            .catch(() => {});
      };
      if (user)
        void billingClient()
          .then((client) => {
            if (controller.signal.aborted) return;
            listeningClient = client;
            client.addCustomerInfoUpdateListener(onCustomerInfo);
          })
          .catch(() => {}); // refresh reports initialization failures.
      return () => {
        controller.abort();
        focusController.current = null;
        subscription.remove();
        listeningClient?.removeCustomerInfoUpdateListener(onCustomerInfo);
      };
    }, [refresh, user]),
  );

  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    refreshVersion.current++;
    operation.current = true;
    setWorking(true);
    setError('');
    setNotice('');
    const uid = user?.uid;
    try {
      await action();
    } catch (reason) {
      if (auth?.currentUser?.uid === uid) {
        if ((reason as { code?: string })?.code === '20') setPending('approval');
        setError(billingError(reason));
      }
    } finally {
      operation.current = false;
      setWorking(false);
    }
  };

  const verifyPurchase = async () => {
    const uid = user?.uid;
    const signal = focusController.current?.signal;
    if (!signal || signal.aborted || auth?.currentUser?.uid !== uid) return;
    setPending('verification');
    setNotice('Confirming your membership…');
    const result = await verifySubscription(getAiAccess, signal);
    if (signal.aborted || auth?.currentUser?.uid !== uid) return;
    setAccess(result);
    setPending(result.paid ? null : 'verification');
    setNotice(
      result.paid
        ? 'Anything Pro is ready. You can return to your draft.'
        : 'Your purchase is still being verified. Refresh in a moment, or restore a purchase made with this store account.',
    );
  };
  const options = subscriptionPlans(plans);
  const plan = options.find((value) => value.id === selected);
  const paid = access?.paid === true;
  const previewing = __DEV__ && state.devPro;
  const showMember = paid || storeActive || previewing;
  const displayedAccess = previewing ? { remaining: 100, limit: 100 } : access;
  const canPurchase =
    !!user &&
    !!plan?.storePackage &&
    (!!access || REVENUECAT_TEST_MODE) &&
    !paid &&
    !previewing &&
    !storeActive &&
    !pending &&
    !loading &&
    !working &&
    !state.busy;
  const subscribe = () => {
    if (!user) {
      void state.signIn();
      return;
    }
    void run(async () => {
      const client = await billingClient();
      if (paid || storeActive) {
        if (REVENUECAT_TEST_MODE) {
          setNotice(
            'Manage or cancel this test subscription in RevenueCat → Customers. Test Store renewals expire automatically.',
          );
          return;
        }
        const info = await client.getCustomerInfo();
        if (info.managementURL) await openLink(info.managementURL);
        else await client.showManageSubscriptions();
        return;
      }
      if (!canPurchase || !plan?.storePackage) return;
      const purchase = await client.purchasePackage(plan.storePackage);
      if (auth?.currentUser?.uid !== user.uid) return;
      setCustomer(purchase.customerInfo);
      if (!hasPro(purchase.customerInfo)) {
        setPending('verification');
        setError(
          'Purchase completed, but subscription access is not active. Refresh or restore; do not buy again.',
        );
        return;
      }
      try {
        await verifyPurchase();
      } catch {
        setError('Purchase confirmed. Refresh to verify access; you do not need to buy again.');
      }
    });
  };
  const muted = { color: colors.muted, fontSize: 12, lineHeight: 19 };
  const disabled =
    working || loading || state.busy || (!!user && !paid && !storeActive && !canPurchase);
  const membership = customer?.entitlements.active[ENTITLEMENT_ID];
  const expiration = membership?.expirationDate ? new Date(membership.expirationDate) : null;
  const billingDate =
    expiration && Number.isFinite(expiration.getTime())
      ? expiration.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';
  const restore = () =>
    void run(async () => {
      const client = await billingClient();
      const info = await client.restorePurchases();
      if (auth?.currentUser?.uid !== user?.uid) return;
      setCustomer(info);
      if (!hasPro(info)) {
        setNotice('No active subscription was found for this account.');
        return;
      }
      try {
        await verifyPurchase();
      } catch {
        setError('Subscription restored. Refresh to verify access; do not buy again.');
      }
    });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ headerShown: false, statusBarStyle: 'light' }} />
      <MembershipBackdrop />
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340, overflow: 'hidden' }}
      >
        <Image
          source={require('../../assets/pro-space/outpost-top.png')}
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: artWidth,
            height: (artWidth * 19) / 9,
          }}
        />
        <View
          style={{
            position: 'absolute',
            inset: 0,
            experimental_backgroundImage:
              'linear-gradient(to right, rgba(16,18,15,0.8) 0%, rgba(16,18,15,0.7) 55%, rgba(16,18,15,0) 100%), linear-gradient(to bottom, rgba(16,18,15,0) 75%, #10120F 100%)',
          }}
        />
      </View>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close membership"
          onPress={close}
          hitSlop={4}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <X size={23} color={colors.ink} strokeWidth={1.5} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityState={{ disabled: working || loading || !user || previewing }}
          disabled={working || loading || !user || previewing}
          onPress={restore}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 10,
            opacity: !user || working || loading ? 0.4 : pressed ? 0.5 : 1,
          })}
        >
          <Text
            allowFontScaling={false}
            style={{ color: colors.ink, fontSize: 12, fontWeight: '500' }}
          >
            Restore
          </Text>
        </Pressable>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 16,
          gap: 16,
          maxWidth: 560,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View style={{ minHeight: 212, justifyContent: 'center', paddingBottom: 24, gap: 3 }}>
          <Text
            allowFontScaling={false}
            style={{
              color: colors.muted,
              fontSize: 10,
              fontFamily: fonts.mono,
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            ANYTHING / PRO
          </Text>
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={{
              color: colors.ink,
              fontSize: 48,
              lineHeight: 54,
              letterSpacing: -2,
              fontWeight: '400',
            }}
          >
            A space for
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              color: colors.ink,
              fontSize: 58,
              lineHeight: 66,
              letterSpacing: -2,
              fontFamily: fonts.editorial,
              fontStyle: 'italic',
            }}
          >
            more.
          </Text>
        </View>
        {!showMember && (
          <View
            style={{
              paddingVertical: 4,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Text
                allowFontScaling={false}
                style={{
                  color: colors.ink,
                  fontSize: 44,
                  lineHeight: 50,
                  letterSpacing: -2,
                  fontWeight: '700',
                }}
              >
                100
              </Text>
              <View style={{ gap: 3, flex: 1 }}>
                <Text allowFontScaling={false} style={{ color: colors.ink, fontSize: 14 }}>
                  AI responses
                </Text>
                <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 12 }}>
                  A fresh allowance every month.
                </Text>
              </View>
            </View>
            <Text
              allowFontScaling={false}
              style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}
            >
              Write, refine and research with your collection.
            </Text>
          </View>
        )}

        {showMember ? (
          <View
            style={{
              padding: 22,
              gap: 20,
              borderRadius: 12,
              backgroundColor: colors.paper,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}
              >
                Anything Pro
              </Text>
              <Text allowFontScaling={false} style={{ color: colors.accent, fontSize: 12 }}>
                {previewing ? 'Preview' : paid ? 'Active' : 'Verifying access'}
              </Text>
            </View>
            {(paid || previewing) && displayedAccess && (
              <>
                <Text
                  allowFontScaling={false}
                  style={{
                    color: colors.ink,
                    fontSize: 40,
                    lineHeight: 48,
                    fontWeight: '500',
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -1.5,
                  }}
                >
                  {displayedAccess.remaining}
                  <Text
                    allowFontScaling={false}
                    style={{ color: colors.muted, fontSize: 13, letterSpacing: 0 }}
                  >
                    {' '}
                    / {displayedAccess.limit} responses left
                  </Text>
                </Text>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: displayedAccess.limit,
                    now: displayedAccess.remaining,
                  }}
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.soft,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.max(0, Math.min(100, (displayedAccess.remaining / Math.max(1, displayedAccess.limit)) * 100))}%`,
                      backgroundColor: colors.aiBlue,
                    }}
                  />
                </View>
                <Text allowFontScaling={false} style={muted}>
                  Your allowance refreshes on the first of each month (UTC).
                </Text>
              </>
            )}
            {!!billingDate && !previewing && (
              <Text allowFontScaling={false} style={muted}>
                {membership?.willRenew ? 'Renews' : 'Access until'} {billingDate}
              </Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {!loading && !options.length && (
              <View
                style={{
                  paddingVertical: 15,
                  gap: 5,
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}
                >
                  {user ? 'Plans are unavailable right now' : 'Your membership starts here'}
                </Text>
                <Text allowFontScaling={false} style={muted}>
                  {user
                    ? 'Refresh to load the latest store prices.'
                    : 'Sign in to see your plans and keep Pro with your account.'}
                </Text>
              </View>
            )}
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Subscription plans"
              style={{ flexDirection: 'row', gap: 10 }}
            >
              {options.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.title}, ${item.price} per ${item.period}. ${item.detail}`}
                  accessibilityState={{
                    checked: selected === item.id,
                    disabled: working || !!pending,
                  }}
                  disabled={working || !!pending}
                  onPress={() => setSelected(item.id)}
                  style={({ pressed }) => ({
                    flex: 1,
                    gap: 12,
                    minHeight: 156,
                    padding: 16,
                    borderRadius: 20,
                    backgroundColor: selected === item.id ? colors.ink : colors.paper,
                    experimental_backgroundImage:
                      selected === item.id
                        ? 'linear-gradient(145deg, #F1EFE3 0%, #D9E0CC 100%)'
                        : 'linear-gradient(145deg, #252B21 0%, #181C16 100%)',
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: selected === item.id ? colors.canvas : colors.ink,
                        fontSize: 14,
                        lineHeight: 20,
                        fontWeight: '600',
                      }}
                    >
                      {item.title}
                    </Text>
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: selected === item.id ? colors.canvas : colors.muted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected === item.id && (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.canvas,
                          }}
                        />
                      )}
                    </View>
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                      style={{
                        color: selected === item.id ? colors.canvas : colors.ink,
                        fontSize: 24,
                        lineHeight: 30,
                        fontWeight: '600',
                        letterSpacing: -0.6,
                      }}
                    >
                      {item.price}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: selected === item.id ? '#535C49' : colors.muted,
                        fontSize: 11,
                        lineHeight: 16,
                      }}
                    >
                      per {item.period}
                    </Text>
                  </View>
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: selected === item.id ? '#535C49' : colors.muted,
                      fontSize: 10,
                      lineHeight: 16,
                      minHeight: 32,
                    }}
                  >
                    {item.savings > 0 ? `Save ${item.savings}% · ` : ''}
                    {item.detail}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!previewing && !!(error || notice) && (
          <View
            style={{
              gap: 4,
              paddingLeft: 12,
              borderLeftWidth: 2,
              borderLeftColor: error ? colors.danger : colors.aiBlue,
            }}
          >
            <Text
              allowFontScaling={false}
              selectable
              accessibilityRole={error ? 'alert' : undefined}
              accessibilityLiveRegion="polite"
              style={{ color: error ? colors.danger : colors.accent, fontSize: 12, lineHeight: 19 }}
            >
              {error || notice}
            </Text>
            {!!user && !working && !loading && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (focusController.current) void refresh(focusController.current.signal);
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text
                  allowFontScaling={false}
                  style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}
                >
                  Check again
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: 'transparent',
          experimental_backgroundImage:
            'linear-gradient(to bottom, rgba(16,18,15,0) 0%, rgba(16,18,15,0.95) 55%, #10120F 100%)',
        }}
      >
        <View style={{ maxWidth: 512, width: '100%', alignSelf: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              previewing
                ? 'Back to collection'
                : paid || storeActive
                  ? 'Manage subscription'
                  : !user
                    ? 'Continue with Google'
                    : `Subscribe to ${plan?.title || 'Anything Pro'}`
            }
            accessibilityState={{
              disabled: !previewing && disabled,
              busy: !previewing && (working || loading),
            }}
            disabled={!previewing && disabled}
            onPress={previewing ? () => router.replace('/') : subscribe}
            style={({ pressed }) => ({
              minHeight: 54,
              borderRadius: 12,
              backgroundColor: colors.ink,
              paddingHorizontal: 22,
              paddingVertical: 15,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: !previewing && disabled ? 0.45 : pressed ? 0.8 : 1,
            })}
          >
            {!previewing && (working || loading || !user) && (
              <View
                style={{
                  position: 'absolute',
                  left: 20,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                }}
              >
                {working || loading ? <ActivityIndicator color={colors.canvas} /> : <GoogleMark />}
              </View>
            )}
            <Text
              allowFontScaling={false}
              style={{
                color: colors.canvas,
                fontSize: 15,
                lineHeight: 20,
                fontWeight: '600',
                flex: 1,
                textAlign: 'center',
              }}
            >
              {previewing
                ? 'Back to collection'
                : working || loading || state.busy
                  ? 'Please wait…'
                  : paid || storeActive
                    ? 'Manage subscription'
                    : pending === 'verification'
                      ? 'Verifying your purchase'
                      : pending === 'approval'
                        ? 'Awaiting payment approval'
                        : !user
                          ? 'Continue with Google'
                          : REVENUECAT_TEST_MODE
                            ? 'Try test subscription'
                            : 'Get Anything Pro'}
            </Text>
          </Pressable>
          <Text
            allowFontScaling={false}
            style={{
              color: colors.muted,
              fontSize: 10,
              lineHeight: 16,
              textAlign: 'center',
              marginTop: 14,
            }}
          >
            {previewing
              ? 'Development preview · no purchase or AI access change'
              : REVENUECAT_TEST_MODE
                ? 'Test Store only · no real charge'
                : paid || storeActive
                  ? 'Manage or cancel in your store account.'
                  : plan
                    ? `${plan.price} / ${plan.period} · Auto-renews. Cancel anytime.`
                    : 'No payment until you confirm in the store.'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            {[
              [terms, 'Terms'],
              [privacy, 'Privacy'],
            ].map(([url, label]) => (
              <Pressable
                key={label}
                accessibilityRole="link"
                accessibilityLabel={label === 'Terms' ? 'Terms and conditions' : 'Privacy policy'}
                disabled={working}
                onPress={() =>
                  void openLink(url).catch((reason) =>
                    setError(
                      reason instanceof Error ? reason.message : 'Could not open this page.',
                    ),
                  )
                }
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}
              >
                <Text
                  allowFontScaling={false}
                  style={{ color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
