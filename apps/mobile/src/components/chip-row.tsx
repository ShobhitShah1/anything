import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Chip } from './ui';
import { space } from '../theme';
import { useCollection } from '../state/collection';

export function ChipRow<T extends string>({
  options,
  value,
  onSelect,
  edgeInset,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onSelect: (value: T) => void;
  edgeInset: number;
}) {
  const { colors } = useCollection();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const rects = useRef<Partial<Record<T, { x: number; width: number }>>>({});
  const didInitialCenter = useRef(false);
  const indicatorValue = useRef<T | undefined>(undefined);
  const [viewportWidth, setViewportWidth] = useState(0);
  const contentInset = space.md + 6;
  const reduced = useReducedMotion();
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.get(),
    transform: [{ translateX: indicatorX.get() }],
  }));
  const center = useCallback(
    (selected: T, animated = true) => {
      const rect = rects.current[selected];

      if (!rect || !viewportWidth) return;
      scrollRef.current?.scrollTo({
        x: Math.max(0, contentInset + rect.x + (rect.width - viewportWidth) / 2),
        animated: animated && !reduced,
      });
    },
    [contentInset, reduced, viewportWidth],
  );

  useEffect(() => {
    const rect = rects.current[value];

    if (!rect) return;
    const animate = indicatorValue.current !== undefined && indicatorValue.current !== value;
    const config = {
      duration: reduced ? 0 : 160,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    };

    indicatorX.set(animate ? withTiming(rect.x, config) : rect.x);
    indicatorWidth.set(animate ? withTiming(rect.width, config) : rect.width);
    indicatorValue.current = value;

    if (!didInitialCenter.current && viewportWidth) {
      didInitialCenter.current = true;
      center(value, false);
    }
  }, [center, indicatorWidth, indicatorX, reduced, value, viewportWidth]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      style={{ marginHorizontal: -edgeInset }}
      showsHorizontalScrollIndicator={false}
      onLayout={({ nativeEvent }) => setViewportWidth(nativeEvent.layout.width)}
      contentContainerStyle={{ paddingHorizontal: contentInset }}
    >
      <View style={{ position: 'relative', flexDirection: 'row', gap: 2 }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 6,
              height: 32,
              borderRadius: 99,
              backgroundColor: colors.ink,
            },
            indicatorStyle,
          ]}
        />
        {options.map(({ value: option, label }) => (
          <View
            key={option}
            onLayout={({ nativeEvent: { layout } }) => {
              rects.current[option] = { x: layout.x, width: layout.width };
              if (option === value && indicatorValue.current === undefined) {
                indicatorX.set(layout.x);
                indicatorWidth.set(layout.width);
                indicatorValue.current = value;
              }
            }}
          >
            <Chip
              title={label}
              selected={value === option}
              onPress={() => {
                didInitialCenter.current = true;
                onSelect(option);
              }}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
