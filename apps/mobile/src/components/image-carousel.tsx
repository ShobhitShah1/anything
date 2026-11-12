import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { AdaptiveImage } from './adaptive-image';
import { useCollection } from '../state/collection';
import { radius } from '../theme';

type Photo = { uri: string; ratio?: number };

function Slide({
  photo,
  index,
  labelIndex,
  width,
  height,
  pitch,
  scrollX,
  onRemove,
}: {
  photo: Photo;
  index: number;
  labelIndex: number;
  width: number;
  height: number;
  pitch: number;
  scrollX: SharedValue<number>;
  onRemove?: () => void;
}) {
  const { colors } = useCollection();
  const motion = useAnimatedStyle(() => {
    const range = [(index - 1) * pitch, index * pitch, (index + 1) * pitch];

    return {
      opacity: interpolate(scrollX.value, range, [0.82, 1, 0.82], Extrapolation.CLAMP),
      transform: [
        { perspective: 900 },
        { rotateY: `${interpolate(scrollX.value, range, [8, 0, -8], Extrapolation.CLAMP)}deg` },
        { translateY: interpolate(scrollX.value, range, [6, 0, 6], Extrapolation.CLAMP) },
        { scale: interpolate(scrollX.value, range, [0.92, 1, 0.92], Extrapolation.CLAMP) },
      ],
    };
  });
  const photoHeight = Math.min(height, width / (photo.ratio || 4 / 3));

  return (
    <Animated.View
      style={[{ width, height, justifyContent: 'center', alignItems: 'center' }, motion]}
      accessibilityLabel={`Photo ${labelIndex + 1}`}
    >
      <View style={{ width, height: photoHeight }}>
        <AdaptiveImage
          uri={photo.uri}
          ratio={photo.ratio}
          width={width}
          priority="high"
          style={{ borderRadius: radius.card, backgroundColor: 'transparent', overflow: 'hidden' }}
        />
        {onRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove image ${labelIndex + 1}`}
            onPress={onRemove}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 18,
              backgroundColor: colors.overlay,
            }}
          >
            <X size={16} color={colors.ink} strokeWidth={2} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export function ImageCarousel({
  photos,
  width,
  onRemove,
}: {
  photos: Photo[];
  width: number;
  onRemove?: (index: number) => void;
}) {
  const { colors } = useCollection();
  const ref = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const multiple = photos.length > 1;
  const slideWidth = width * (multiple ? 0.88 : 1);
  const gap = 4;
  const pitch = slideWidth + gap;
  const height = Math.max(0, ...photos.map(({ ratio }) => slideWidth / (ratio || 4 / 3)));
  const onScroll = useAnimatedScrollHandler({
    onScroll: ({ contentOffset }) => {
      scrollX.value = contentOffset.x;
    },
  });

  useEffect(() => {
    setActiveIndex(0);
    scrollX.set(0);
    const frame = requestAnimationFrame(() => ref.current?.scrollTo({ x: 0, animated: false }));

    return () => cancelAnimationFrame(frame);
  }, [photos.length, pitch, scrollX]);

  if (!photos.length) return null;

  return (
    <View style={{ gap: 6 }}>
      <Animated.ScrollView
        ref={ref}
        horizontal
        snapToInterval={pitch}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: (width - slideWidth) / 2,
          gap,
          alignItems: 'center',
        }}
        style={{ width, height, overflow: 'visible' }}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const position = Math.round(nativeEvent.contentOffset.x / pitch);

          setActiveIndex(Math.max(0, Math.min(position, photos.length - 1)));
        }}
      >
        {photos.map((photo, index) => (
          <Slide
            key={`${photo.uri.slice(-24)}-${index}`}
            photo={photo}
            index={index}
            labelIndex={index}
            width={slideWidth}
            height={height}
            pitch={pitch}
            scrollX={scrollX}
            onRemove={onRemove ? () => onRemove(index) : undefined}
          />
        ))}
      </Animated.ScrollView>
      {multiple && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          {photos.map((photo, index) => (
            <Pressable
              key={`${photo.uri.slice(-20)}-progress-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Show photo ${index + 1}`}
              accessibilityState={{ selected: activeIndex === index }}
              onPress={() => {
                setActiveIndex(index);
                scrollX.set(index * pitch);
                ref.current?.scrollTo({ x: index * pitch, animated: true });
              }}
              style={{
                width: activeIndex === index ? 28 : 14,
                height: 24,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '100%',
                  height: 3,
                  borderRadius: 3,
                  backgroundColor: activeIndex === index ? colors.accent : colors.line,
                }}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
