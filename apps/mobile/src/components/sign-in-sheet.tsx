import { ActivityIndicator, Text, View } from 'react-native';
import { BottomSheet, Host, RNHostView } from '@expo/ui';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../services/auth';
import { useCollection } from '../state/collection';
import { Action, GoogleMark } from './ui';
import { Feedback } from './feedback';

export function SignInSheet() {
  const state = useCollection();
  const insets = useSafeAreaInsets();
  const { signInPrompt, user, busy, colors, dark, error } = state;
  if (!signInPrompt || user) return null;
  const dismiss = () => state.setSignInPrompt(null);
  const signIn = async () => {
    await state.signIn();
    if (!auth?.currentUser) return;
    dismiss();
    if (signInPrompt === 'pro') router.push('/subscription');
    else state.setNotice('Signed in. Save your draft when you’re ready.');
  };
  return (
    <Host colorScheme={dark ? 'dark' : 'light'} style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented
        onDismiss={dismiss}
        containerColor={colors.paper}
        shouldDismissOnBackPress={!busy}
        shouldDismissOnClickOutside={!busy}
        contentPadding={{ left: 24, right: 24, top: 8, bottom: Math.max(insets.bottom, 20) }}
      >
        <RNHostView matchContents={{ vertical: true }}>
          <View style={{ gap: 16, paddingBottom: 8 }}>
            <Text
              allowFontScaling={false}
              accessibilityRole="header"
              style={{ color: colors.ink, fontSize: 26, lineHeight: 32, letterSpacing: -0.7 }}
            >
              {signInPrompt === 'pro' ? 'Sign in for Anything Pro' : 'Keep collecting.'}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}
            >
              {signInPrompt === 'pro'
                ? 'Connect your Google account to view plans and keep your subscription with you.'
                : 'You can keep 10 finds without an account. Sign in free to save more. Your finds and draft stay here.'}
            </Text>
            {!!error && <Feedback message={error} error />}
            <Action
              title={busy ? 'Connecting…' : 'Continue with Google'}
              leading={busy ? <ActivityIndicator color={colors.canvas} /> : <GoogleMark />}
              disabled={busy}
              onPress={() => void signIn()}
            />
            <Action title="Not now" secondary disabled={busy} onPress={dismiss} />
          </View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}
