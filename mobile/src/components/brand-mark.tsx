import { useEffect, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useCollection } from '../state/collection';
const AnimatedGroup = Animated.createAnimatedComponent(G);
export function BrandMark({ size = 36, animate = false }: { size?: number; animate?: boolean }) {
  const id = useId().replace(/:/g, '');
  const { colors } = useCollection();
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (animate && !reduced)
      rotation.value = withRepeat(
        withTiming(360, { duration: 14000, easing: Easing.linear }),
        -1,
        false,
      );
    return () => cancelAnimation(rotation);
  }, [animate, reduced, rotation]);
  const flow = useAnimatedProps(() => ({ rotation: rotation.value, originX: 20, originY: 20 }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel="Anything logo">
      <Defs>
        <Mask id={`${id}mark`}>
          <Circle cx="16" cy="22" r="10" stroke="white" strokeWidth="5" fill="none" />
          <Path d="M26 12v20" stroke="white" strokeWidth="5" strokeLinecap="round" />
          <Circle cx="35" cy="32" r="2.5" fill="white" />
        </Mask>
        <RadialGradient id={`${id}pearl`}>
          <Stop stopColor="#bdadf4" />
          <Stop offset={0.5} stopColor="#84bdcc" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#84bdcc" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${id}warm`}>
          <Stop stopColor="#f0c6aa" />
          <Stop offset="1" stopColor="#d9b4cc" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G mask={`url(#${id}mark)`}>
        <Rect width="40" height="40" fill={colors.ink} />
        <AnimatedGroup animatedProps={flow} opacity={0.85}>
          <Ellipse cx="10" cy="13" rx="24" ry="17" fill={`url(#${id}pearl)`} />
          <Ellipse cx="30" cy="30" rx="21" ry="17" fill={`url(#${id}warm)`} />
        </AnimatedGroup>
      </G>
    </Svg>
  );
}
