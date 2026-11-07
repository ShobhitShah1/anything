import { memo, useEffect, useId, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useCollection } from '../state/collection';

export interface AiEditorLightProps {
  active: boolean;
  working: boolean;
}

const ribbon = {
  '0%': { transform: [{ translateX: '-12%' }, { translateY: 4 }, { scaleY: 0.95 }], opacity: 0.8 },
  '50%': { transform: [{ translateX: '12%' }, { translateY: -4 }, { scaleY: 1.08 }], opacity: 1 },
  '100%': {
    transform: [{ translateX: '-12%' }, { translateY: 4 }, { scaleY: 0.95 }],
    opacity: 0.8,
  },
};

export const AiEditorLight = memo(function AiEditorLight({ active, working }: AiEditorLightProps) {
  const { dark, colors } = useCollection();
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const strength = useSharedValue(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (value) =>
      setForeground(value === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    strength.set(
      withTiming(active && foreground ? (working ? 1 : 0.65) : 0, { duration: reduced ? 0 : 420 }),
    );
    return () => cancelAnimation(strength);
  }, [active, foreground, working, reduced, strength]);
  const style = useAnimatedStyle(() => ({ opacity: strength.get() * (dark ? 0.8 : 0.65) }));
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}
    >
      {[colors.aiBlue, colors.aiRose, colors.aiAmber].map((color, index) => (
        <Animated.View
          key={color}
          style={{
            position: 'absolute',
            left: `${index * 28 - 30}%`,
            bottom: -52,
            width: '110%',
            height: 260,
            animationName: reduced ? undefined : ribbon,
            animationDuration: 11000 + index * 1300,
            animationDelay: -index * 3100,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationPlayState: active && foreground && !reduced ? 'running' : 'paused',
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id={`${id}${index}`} cx="50%" cy="80%" rx="50%" ry="75%">
                <Stop stopColor={color} stopOpacity={0.9} />
                <Stop offset="0.35" stopColor={color} stopOpacity={0.5} />
                <Stop offset="0.7" stopColor={color} stopOpacity={0.15} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="400" height="150" fill={`url(#${id}${index})`} />
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
  );
});
