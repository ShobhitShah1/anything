import { useCallback, useRef, useState } from 'react';
import { auth } from '../services/auth';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { ArrowRight, Check, X } from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { GoogleMark } from '../components/ui';
import { getAiAccess, type AiAccess } from '../services/ai';
import { billingClient, REVENUECAT_TEST_MODE } from '../services/billing';
import { billingError, ENTITLEMENT_ID, hasPro } from '../utils/billing-config';
import { openLink } from '../utils/open-link';
import { subscriptionPlans } from '../utils/subscription-plans';
import { fonts } from '../theme';
import { MembershipBackdrop } from '../components/membership-backdrop';
import { verifySubscription } from '../utils/verify-subscription';

const terms = process.env.EXPO_PUBLIC_TERMS_URL || '';
const privacy = process.env.EXPO_PUBLIC_PRIVACY_URL || '';
const legalReady = /^https:\/\//.test(terms) && /^https:\/\//.test(privacy);

export default function Subscription() {
  const state = useCollection();
  const { colors, user } = state;
  const insets = useSafeAreaInsets();
  const [access, setAccess] = useState<AiAccess | null>(null);
  const [plans, setPlans] = useState<PurchasesPackage[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const storeActive = !!customer && hasPro(customer);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(!!user);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<'approval' | 'verification' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(false);
  const focusController = useRef<AbortController | null>(null);
  const refreshVersion = useRef(0);

  const refresh = useCallback(
    async (signal: AbortSignal) => {
      if (!user) return;
      const version = ++refreshVersion.current;
      setLoading(true);
      setError('');
      setNotice('');
      const results = await Promise.allSettled([
        getAiAccess(signal),
        billingClient().then(async (client) => {
          await client.invalidateCustomerInfoCache();
          const [offerings, customer] = await Promise.all([
            client.getOfferings(),
            client.getCustomerInfo(),
          ]);
          return { offerings, customer, active: hasPro(customer) };
        }),
      ]);
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
        setPlans([]);
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
      setAccess(null);
      setPlans([]);
      setCustomer(null);
      setPending(null);
      setLoading(false);
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
  const canPurchase =
    !!user &&
    !!plan?.storePackage &&
    (!!access || REVENUECAT_TEST_MODE) &&
    !paid &&
    !storeActive &&
    !pending &&
    (legalReady || REVENUECAT_TEST_MODE) &&
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
      <Stack.Screen options={{ headerShown: false }} />
      <MembershipBackdrop />
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
          accessibilityState={{ disabled: working || loading || !user }}
          disabled={working || loading || !user}
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
          paddingHorizontal: 26,
          paddingTop: 22,
          paddingBottom: 18,
          gap: 24,
          maxWidth: 560,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View style={{ gap: 14 }}>
          <Text
            allowFontScaling={false}
            style={{
              color: colors.accent,
              fontSize: 10,
              lineHeight: 16,
              letterSpacing: 2.2,
              fontWeight: '700',
            }}
          >
            ANYTHING PRO
          </Text>
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={{
              color: colors.ink,
              fontSize: 37,
              lineHeight: 43,
              fontWeight: '600',
              letterSpacing: -1.5,
            }}
          >
            {paid || storeActive ? 'Your creative space.' : 'More from'}
            {!paid && !storeActive && (
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: fonts.editorial,
                  fontStyle: 'italic',
                  fontWeight: '400',
                  letterSpacing: -1,
                }}
              >
                {'\n'}every idea.
              </Text>
            )}
          </Text>
          <Text
            allowFontScaling={false}
            style={{ color: colors.accent, fontSize: 14, lineHeight: 22 }}
          >
            {paid
              ? 'Your membership, usage, and next chapter.'
              : '100 AI responses a month. A little help to write, explore, and make things happen.'}
          </Text>
        </View>

        <View style={{ gap: 13 }}>
          {[
            'Turn a thought into notes, lists, and plans',
            'Refine a draft while keeping your voice',
            'Explore ideas with sources you can open',
          ].map((title) => (
            <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Check size={15} strokeWidth={1.8} color={colors.accent} />
              <Text
                allowFontScaling={false}
                style={{ flex: 1, color: colors.ink, fontSize: 13, lineHeight: 20 }}
              >
                {title}
              </Text>
            </View>
          ))}
        </View>

        {paid || storeActive ? (
          <View
            style={{
              padding: 20,
              gap: 16,
              borderRadius: 22,
              backgroundColor: colors.paper,
              borderWidth: 1,
              borderColor: colors.line,
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
                {paid ? 'Active' : 'Verifying access'}
              </Text>
            </View>
            {paid && access && (
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
                  {access.remaining}
                  <Text
                    allowFontScaling={false}
                    style={{ color: colors.muted, fontSize: 13, letterSpacing: 0 }}
                  >
                    {' '}
                    / {access.limit} responses left
                  </Text>
                </Text>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: access.limit, now: access.remaining }}
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
                      width: `${Math.max(0, Math.min(100, (access.remaining / Math.max(1, access.limit)) * 100))}%`,
                      backgroundColor: colors.aiBlue,
                    }}
                  />
                </View>
                <Text allowFontScaling={false} style={muted}>
                  Your allowance refreshes on the first of each month (UTC).
                </Text>
              </>
            )}
            {!!billingDate && (
              <Text allowFontScaling={false} style={muted}>
                {membership?.willRenew ? 'Renews' : 'Access until'} {billingDate}
              </Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text
              allowFontScaling={false}
              style={{ color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 2 }}
            >
              Same possibilities. Your preferred pace.
            </Text>
            {loading && (
              <ActivityIndicator color={colors.accent} accessibilityLabel="Loading store prices" />
            )}
            {!loading && !options.length && (
              <View
                style={{
                  paddingVertical: 15,
                  gap: 5,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
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
              style={{ gap: 10 }}
            >
              {options.map((item) => {
                const chosen = selected === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${item.title}, ${item.price} per ${item.period}. ${item.detail}`}
                    accessibilityState={{ checked: chosen, disabled: working || !!pending }}
                    disabled={working || !!pending}
                    onPress={() => setSelected(item.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 17,
                      paddingVertical: 16,
                      borderRadius: 20,
                      borderCurve: 'continuous',
                      borderWidth: 1,
                      borderColor: chosen ? colors.aiBlue : colors.line,
                      backgroundColor: chosen ? colors.soft : colors.paper,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 19,
                        height: 19,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: chosen ? colors.accent : colors.muted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {chosen && (
                        <View
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 5,
                            backgroundColor: colors.accent,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        allowFontScaling={false}
                        style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}
                      >
                        {item.title}
                        {item.savings > 0 && (
                          <Text
                            allowFontScaling={false}
                            style={{ color: colors.accent, fontSize: 11, fontWeight: '500' }}
                          >
                            {' '}
                            · Save {item.savings}%
                          </Text>
                        )}
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}
                      >
                        {item.detail}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', maxWidth: '44%', gap: 2 }}>
                      <Text
                        allowFontScaling={false}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        numberOfLines={1}
                        style={{
                          color: colors.ink,
                          fontSize: 23,
                          lineHeight: 29,
                          fontWeight: '500',
                          letterSpacing: -0.8,
                        }}
                      >
                        {item.price}
                      </Text>
                      <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 10 }}>
                        per {item.period}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {!!(error || notice) && (
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

        <View style={{ gap: 9 }}>
          {!paid && (
            <Text allowFontScaling={false} style={{ ...muted, fontSize: 11 }}>
              {access
                ? `${access.remaining} of 3 free AI responses left.`
                : '3 free AI responses per account.'}{' '}
              Your collection and voice-to-text stay free.
            </Text>
          )}
          <Text allowFontScaling={false} style={{ ...muted, fontSize: 10, lineHeight: 16 }}>
            Both plans include 100 responses per UTC calendar month. Unused responses do not roll
            over. Payment is charged at confirmation and renews automatically until canceled in your
            store account.
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              columnGap: 22,
            }}
          >
            {[
              [terms, 'Terms'],
              [privacy, 'Privacy'],
            ].map(([url, title]) => (
              <Pressable
                key={title}
                accessibilityRole="link"
                disabled={working || !/^https:\/\//.test(url)}
                onPress={() =>
                  void run(async () => {
                    await openLink(url);
                  })
                }
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text allowFontScaling={false} style={{ ...muted, fontSize: 11 }}>
                  {title}
                </Text>
              </Pressable>
            ))}
            {!!user && (
              <Pressable
                accessibilityRole="button"
                disabled={working || loading}
                onPress={() => {
                  if (focusController.current) void refresh(focusController.current.signal);
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text allowFontScaling={false} style={{ ...muted, fontSize: 11 }}>
                  Refresh
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        {!REVENUECAT_TEST_MODE && !legalReady && (
          <Text allowFontScaling={false} style={{ ...muted, fontSize: 11, textAlign: 'center' }}>
            Purchases open once our terms and privacy policy are published.
          </Text>
        )}
        {!!access?.remaining && !paid && (
          <Pressable
            accessibilityRole="button"
            disabled={working}
            onPress={close}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 11 }}>
              Use your free responses first
            </Text>
          </Pressable>
        )}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 26,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 14),
          backgroundColor: colors.canvas,
        }}
      >
        <View style={{ maxWidth: 508, width: '100%', alignSelf: 'center', gap: 9 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              paid || storeActive
                ? 'Manage subscription'
                : !user
                  ? 'Continue with Google'
                  : `Subscribe to ${plan?.title || 'Anything Pro'}`
            }
            accessibilityState={{ disabled, busy: working || loading }}
            disabled={disabled}
            onPress={subscribe}
            style={({ pressed }) => ({
              minHeight: 54,
              borderRadius: 99,
              backgroundColor: colors.ink,
              paddingHorizontal: 22,
              paddingVertical: 15,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
            })}
          >
            {working || loading ? (
              <ActivityIndicator color={colors.canvas} />
            ) : !user ? (
              <GoogleMark />
            ) : null}
            <Text
              allowFontScaling={false}
              style={{
                color: colors.canvas,
                fontSize: 15,
                fontWeight: '600',
                flex: 1,
                textAlign: 'center',
              }}
            >
              {working || loading || state.busy
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
            {!working && !loading && (
              <ArrowRight size={18} color={colors.canvas} strokeWidth={1.8} />
            )}
          </Pressable>
          <Text
            allowFontScaling={false}
            style={{ color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' }}
          >
            {REVENUECAT_TEST_MODE
              ? 'Test Store only · no real charge'
              : paid || storeActive
                ? 'Manage or cancel in your store account.'
                : plan
                  ? `${plan.price} / ${plan.period} · Auto-renews. Cancel anytime.`
                  : 'No payment until you confirm in the store.'}
          </Text>
        </View>
      </View>
    </View>
  );
}
