import { useEffect, useMemo, useState } from 'react';
import { useLayoutState } from '@shopify/flash-list';
import Image, { type Priority } from 'react-native-fast-image';
import Animated from 'react-native-reanimated';
import { Image as NativeImage, View, type StyleProp, type ViewStyle } from 'react-native';
import { useCollectionTransition } from './collection-motion';
import { containedMedia } from '../utils/motion-geometry';
import { imageRatio } from '../utils/image-ratio';
import { useCollection } from '../state/collection';

const ratios = new Map<string, number>();
const AnimatedImage = Animated.createAnimatedComponent(Image);

export function AdaptiveImage({
  uri,
  ratio,
  thumbnail = false,
  thumbnailHeight = 92,
  width,
  objectFit = 'contain',
  animateLayout = true,
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
  objectFit?: 'cover' | 'contain';
  animateLayout?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useCollection();
  const [status, setStatus] = useState<{
    uri: string;
    loaded: boolean;
    failed: boolean;
    retry: boolean;
  }>({ uri: '', loaded: false, failed: false, retry: false });
  const retry = status.uri === uri && status.retry;
  const imageLoaded = status.uri === uri && status.loaded;
  const source = useMemo(
    () => ({ uri, cache: retry ? ('web' as const) : ('immutable' as const), priority }),
    [uri, priority, retry],
  );
  const [loaded, setLoaded] = useLayoutState<{ uri: string; ratio: number } | undefined>(undefined);
  const aspectRatio =
    (loaded?.uri === uri ? loaded.ratio : ratios.get(uri)) ||
    (ratio && imageRatio(ratio, 1)) ||
    4 / 3;
  const [box, setBox] = useLayoutState({
    width: width || 0,
    height: thumbnail ? thumbnailHeight : (width || 0) / aspectRatio,
  });
  const mediaWidth = width ?? box.width;
  const mediaHeight =
    width === undefined ? box.height : thumbnail ? thumbnailHeight : width / aspectRatio;
  const rect = useMemo(
    () =>
      objectFit === 'cover'
        ? { x: 0, y: 0, width: mediaWidth, height: mediaHeight }
        : containedMedia(mediaWidth, mediaHeight, aspectRatio),
    [objectFit, mediaWidth, mediaHeight, aspectRatio],
  );
  const layout = useCollectionTransition('media');

  useEffect(() => {
    if (status.uri !== uri || !status.failed || status.retry) return;
    const timer = setTimeout(
      () => setStatus({ uri, loaded: false, failed: true, retry: true }),
      500,
    );

    return () => clearTimeout(timer);
  }, [uri, status]);

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
        layout={animateLayout ? layout : undefined}
        source={source}

        recyclingKey={uri}
        objectFit={objectFit}
        transition={0}
        onError={() => {
          setStatus((current) => ({
            uri,
            loaded: false,
            failed: true,
            retry: current.uri === uri && current.retry,
          }));
          onReady?.();
        }}
        onLoad={({ nativeEvent }) => {
          setStatus({ uri, loaded: true, failed: false, retry: false });
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
      {!imageLoaded && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <NativeImage
            source={require('../../assets/brand-mark.png')}
            resizeMode="contain"
            style={{ width: 28, height: 28, tintColor: colors.muted, opacity: 0.55 }}
          />
        </View>
      )}
    </View>
  );
}
