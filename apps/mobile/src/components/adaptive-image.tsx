import { useMemo } from 'react';
import { useLayoutState } from '@shopify/flash-list';
import Image, { type Priority } from 'react-native-fast-image';
import Animated from 'react-native-reanimated';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useCollectionTransition } from './collection-motion';
import { containedMedia } from '../utils/motion-geometry';
import { imageRatio } from '../utils/image-ratio';

const ratios = new Map<string, number>();
const AnimatedImage = Animated.createAnimatedComponent(Image);

export function AdaptiveImage({
  uri,
  ratio,
  thumbnail = false,
  thumbnailHeight = 92,
  width,
  style,
  onReady,
  priority = 'normal',
}: {
  onReady?: () => void;
  priority?: Priority;
  uri: string;
  ratio?: number;
  thumbnail?: boolean;
  thumbnailHeight?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const source = useMemo(() => ({ uri, cache: 'immutable' as const, priority }), [uri, priority]);
  const [loaded, setLoaded] = useLayoutState<{ uri: string; ratio: number } | undefined>(undefined);
  const aspectRatio =
    (loaded?.uri === uri ? loaded.ratio : ratios.get(uri)) ||
    (ratio && imageRatio(ratio, 1)) ||
    4 / 3;
  const [box, setBox] = useLayoutState({
    width: width || 0,
    height: thumbnail ? thumbnailHeight : (width || 0) / aspectRatio,
  });
  const rect = useMemo(
    () =>
      containedMedia(
        width ?? box.width,
        width === undefined ? box.height : thumbnail ? thumbnailHeight : width / aspectRatio,
        aspectRatio,
      ),
    [width, thumbnail, thumbnailHeight, box, aspectRatio],
  );
  const layout = useCollectionTransition('media');
  return (
    <View
      onLayout={({ nativeEvent: { layout } }) => {
        if (
          width === undefined &&
          (Math.abs(box.width - layout.width) > 0.5 || Math.abs(box.height - layout.height) > 0.5)
        )
          setBox({ width: layout.width, height: layout.height });
      }}
      style={[
        thumbnail ? { width: '100%', height: '100%' } : { width: '100%', aspectRatio },
        style,
      ]}
    >
      <AnimatedImage
        layout={layout}
        source={source}

        recyclingKey={uri}
        objectFit="contain"
        transition={0}
        onError={onReady}
        onLoad={({ nativeEvent }) => {
          onReady?.();
          const measured = imageRatio(nativeEvent.width, nativeEvent.height);
          if (!measured) return;
          if (!uri.startsWith('data:')) {
            if (ratios.size >= 256) ratios.delete(ratios.keys().next().value!);
            ratios.set(uri, measured);
          }
          if (aspectRatio !== measured) setLoaded({ uri, ratio: measured });
        }}
        style={[
          {
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            transformOrigin: 'top left',
            borderRadius: 0,
          },
        ]}
      />
    </View>
  );
}
