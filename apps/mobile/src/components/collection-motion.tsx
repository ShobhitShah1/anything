import { createContext, useContext, useMemo, type ComponentProps, type ReactElement } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  withTiming,
  useAnimatedStyle,
  type LayoutAnimationFunction,
  type SharedValue,
} from 'react-native-reanimated';
import { radius } from '../theme';
import { crossesViewport } from '../utils/motion-geometry';

export const CollectionMotion = createContext<{
  enabled: SharedValue<boolean>;
  ids: readonly string[];
  liftedId: SharedValue<string | null>;
} | null>(null);
const timing = { duration: 300, easing: Easing.bezier(0.77, 0, 0.175, 1) };
function move(from: number, to: number) {
  'worklet';
  return Math.abs(from - to) > 0.5 ? withTiming(to, timing) : to;
}

export function useCollectionTransition(kind: 'position' | 'frame' | 'media') {
  const enabled = useContext(CollectionMotion)?.enabled;
  return useMemo<LayoutAnimationFunction>(
    () => (values) => {
      'worklet';
      const animate =
        enabled?.get() === true &&
        crossesViewport(
          values.currentGlobalOriginY,
          values.currentHeight,
          values.targetGlobalOriginY,
          values.targetHeight,
          values.windowHeight,
        );
      const target = {
        originX: values.targetOriginX,
        originY: values.targetOriginY,
        width: values.targetWidth,
        height: values.targetHeight,
      };
      if (!animate) return { initialValues: target, animations: target };
      // Native layout captures the previous presentation before the destination is painted.
      const initial = {
        ...target,
        transform: [
          { translateX: values.currentOriginX - target.originX },
          { translateY: values.currentOriginY - target.originY },
        ],
      };
      const animations = {
        ...target,
        transform: [
          { translateX: move(values.currentOriginX - target.originX, 0) },
          { translateY: move(values.currentOriginY - target.originY, 0) },
        ],
      };
      if (kind === 'frame') {
        return {
          initialValues: { ...initial, width: values.currentWidth, height: values.currentHeight },
          animations: {
            ...animations,
            width: move(values.currentWidth, target.width),
            height: move(values.currentHeight, target.height),
          },
        };
      }
      if (kind === 'media') {
        const scale =
          target.width > 0 && values.currentWidth > 0 ? values.currentWidth / target.width : 1;
        return {
          initialValues: { ...initial, transform: [...initial.transform, { scale }] },
          animations: {
            ...animations,
            transform: [
              ...animations.transform,
              { scale: scale === 1 ? 1 : withTiming(1, timing) },
            ],
          },
        };
      }
      return { initialValues: initial, animations };
    },
    [enabled, kind],
  );
}

export function MotionPosition({
  identity,
  ...props
}: ComponentProps<typeof View> & { identity: string }) {
  const layout = useCollectionTransition('position');
  return <Animated.View key={identity} {...props} collapsable={false} layout={layout} />;
}

export function CollectionCell({
  index = 0,
  ...props
}: ComponentProps<typeof View> & { index?: number }) {
  const motion = useContext(CollectionMotion);
  return <MotionPosition {...props} identity={motion?.ids[index] ?? String(index)} />;
}

export function CardFrame({
  identity,
  width,
  backgroundColor,
  hidden = false,
  children,
}: {
  identity: string;
  width: number;
  backgroundColor: string;
  hidden?: boolean;
  children: ReactElement;
}) {
  const layout = useCollectionTransition('frame');
  const liftedId = useContext(CollectionMotion)?.liftedId;
  const visibility = useAnimatedStyle(() => ({
    opacity: liftedId ? (liftedId.get() === identity ? 0 : 1) : hidden ? 0 : 1,
  }));
  return (
    // Yoga measures the final content once; the native frame animates its presentation.
    <Animated.View
      collapsable={false}
      pointerEvents={hidden ? 'none' : 'auto'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[{ width, margin: 6 }, visibility]}
    >
      <Animated.View
        key={identity}
        collapsable={false}
        layout={hidden ? undefined : layout}
        style={{
          width,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor,
          overflow: 'hidden',
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}
