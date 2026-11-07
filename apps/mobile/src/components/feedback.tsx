import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useEffect } from 'react';
import { CircleCheck, CircleAlert, X } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../state/collection';

export function Feedback({
  message,
  error = false,
  onDismiss,
}: {
  message: string;
  error?: boolean;
  onDismiss?: () => void;
}) {
  const { colors } = useCollection();
  const Icon = error ? CircleAlert : CircleCheck;
  const tint = error ? colors.danger : colors.accent;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion={error ? 'assertive' : 'polite'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 14,
        paddingRight: onDismiss ? 4 : 16,
        paddingVertical: 4,
        minHeight: 52,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.paper,
        borderWidth: 0.5,
        borderColor: colors.line,
        boxShadow: '0 3px 16px rgba(0,0,0,0.10)',
      }}
    >
      <Icon size={18} strokeWidth={1.7} color={tint} />
      <Text
        allowFontScaling={false}
        selectable
        style={{ flex: 1, color: colors.ink, fontSize: 13, lineHeight: 19, paddingVertical: 8 }}
      >
        {message}
      </Text>
      {onDismiss && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          style={{
            width: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={17} strokeWidth={1.5} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

export function FeedbackHost() {
  const { error, notice, setError, setNotice } = useCollection();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const message = error || notice;
  const isError = !!error;
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(
      () => {
        if (isError) {
          setError((current) => (current === message ? '' : current));
          setNotice('');
        } else setNotice((current) => (current === message ? '' : current));
      },
      isError ? 3000 : 1800,
    );
    return () => clearTimeout(timer);
  }, [message, isError, setError, setNotice]);
  return message ? (
    <Animated.View
      key={`${!!error}:${message}`}
      entering={
        reduced
          ? FadeIn.duration(120)
          : FadeInUp.duration(180).easing(Easing.bezier(0.23, 1, 0.32, 1))
      }
      exiting={
        reduced
          ? FadeOut.duration(100)
          : FadeOutUp.duration(140).easing(Easing.bezier(0.23, 1, 0.32, 1))
      }
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: Math.max(16, (width - 400) / 2),
        right: Math.max(16, (width - 400) / 2),
        zIndex: 1000,
      }}
    >
      <Feedback
        message={message}
        error={!!error}
        onDismiss={() => {
          setError('');
          setNotice('');
        }}
      />
    </Animated.View>
  ) : null;
}
