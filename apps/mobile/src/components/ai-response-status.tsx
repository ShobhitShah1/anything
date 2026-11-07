import { memo } from 'react';
import { Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useCollection } from '../state/collection';
import { fonts } from '../theme';

const breathe = {
  '0%': { opacity: 0.35 },
  '50%': { opacity: 0.85 },
  '100%': { opacity: 0.35 },
};

export const AiResponseStatus = memo(function AiResponseStatus({
  prompt,
  phase,
}: {
  prompt: string;
  phase: 'thinking' | 'streaming' | 'idle';
}) {
  const { colors } = useCollection();
  const reduced = useReducedMotion();
  const working = phase !== 'idle';
  const waiting = phase === 'thinking';
  const label = waiting ? 'Preparing your draft' : working ? 'Writing your draft' : 'Your draft';
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={{ color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 24 }}
      >
        {prompt}
      </Text>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={label}
        accessibilityState={{ busy: working }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        {working && (
          <Animated.View
            accessible={false}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.ink,
              opacity: 0.6,
              animationName: reduced ? undefined : breathe,
              animationDuration: 1600,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
            }}
          />
        )}
        <Text
          allowFontScaling={false}
          style={{ color: colors.ink, fontFamily: fonts.editorial, fontSize: 23, lineHeight: 30 }}
        >
          {label}
        </Text>
      </View>
      {waiting && (
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ gap: 13, marginTop: 26 }}
        >
          {(['90%', '76%', '54%'] as const).map((width, index) => (
            <Animated.View
              key={width}
              style={{
                width,
                height: 7,
                borderRadius: 4,
                backgroundColor: colors.line,
                opacity: 0.6,
                animationName: reduced ? undefined : breathe,
                animationDuration: 1600,
                animationDelay: index * 140,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
});
