import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCollection } from '../state/collection';

export function BrandMark({ size = 36, animate = false }: { size?: number; animate?: boolean }) {
  const { colors } = useCollection();
  const reduced = useReducedMotion();
  const progress = useSharedValue(animate && !reduced ? 0 : 1);
  useEffect(() => {
    progress.set(
      animate && !reduced
        ? withTiming(1, { duration: 520, easing: Easing.bezier(0.23, 1, 0.32, 1) })
        : 1,
    );
    return () => cancelAnimation(progress);
  }, [animate, reduced, progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: 0.85 + progress.get() * 0.15,
    transform: [{ translateY: (1 - progress.get()) * 4 }, { scale: 0.96 + progress.get() * 0.04 }],
  }));
  return (
    <Animated.Image
      source={require('../../assets/brand-mark.png')}
      accessibilityRole="image"
      accessibilityLabel="Anything logo"
      resizeMode="contain"
      fadeDuration={0}
      style={[{ width: size, height: size, tintColor: colors.ink }, motion]}
    />
  );
}
