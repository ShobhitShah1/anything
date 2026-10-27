import { useEffect, useId, useState } from 'react';
import { AppState, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useCollection } from '../state/collection';

const drift = {
  '0%': { transform: [{ translateX: -8 }, { translateY: -4 }, { scale: 1.02 }] },
  '50%': { transform: [{ translateX: 8 }, { translateY: 4 }, { scale: 1.08 }] },
  '100%': { transform: [{ translateX: -8 }, { translateY: -4 }, { scale: 1.02 }] },
};

export function MembershipBackdrop({ compact = false }: { compact?: boolean }) {
  const { dark } = useCollection();
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (value) =>
      setForeground(value === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: compact ? '100%' : 340,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          opacity: compact ? 0.65 : 1,
          animationName: reduced || compact ? undefined : drift,
          animationDuration: 24000,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          animationPlayState: focused && foreground && !reduced ? 'running' : 'paused',
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 480 340" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id={`${id}blue`}>
              <Stop stopColor={dark ? '#657FC7' : '#ADC9EF'} stopOpacity={dark ? 0.34 : 0.5} />
              <Stop
                offset="0.45"
                stopColor={dark ? '#657FC7' : '#ADC9EF'}
                stopOpacity={dark ? 0.16 : 0.24}
              />
              <Stop offset="1" stopColor={dark ? '#657FC7' : '#ADC9EF'} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`${id}warm`}>
              <Stop stopColor={dark ? '#BC9B8D' : '#E5C7B7'} stopOpacity={dark ? 0.15 : 0.3} />
              <Stop offset="1" stopColor={dark ? '#BC9B8D' : '#E5C7B7'} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="378" cy="34" rx="300" ry="260" fill={`url(#${id}blue)`} />
          <Ellipse cx="60" cy="78" rx="210" ry="160" fill={`url(#${id}warm)`} />
        </Svg>
      </Animated.View>
    </View>
  );
}
