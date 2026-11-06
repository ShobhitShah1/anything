import { useEffect, useState, type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useCollection } from '../state/collection';
import AndroidLaunch from '../../modules/anything-launch';
import { CRITICAL_ASSETS, preloadCriticalAssets } from '../utils/preload-assets';

const nativeLaunch = Platform.OS === 'android' ? AndroidLaunch : null;
const artwork =
  Platform.OS === 'android' && !__DEV__
    ? { uri: 'anything_launch_art' }
    : require('../../assets/splash-art.png');

const isMockEnvironment = typeof (Image as unknown as { prefetch?: unknown })?.prefetch !== 'function';

export function LaunchScreen({ children }: { children: ReactNode }) {
  const { ready, error } = useCollection();
  const reduced = useReducedMotion();
  const [artReady, setArtReady] = useState(false);
  const [artLaidOut, setArtLaidOut] = useState(false);
  const [contentLaidOut, setContentLaidOut] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [assetsReady, setAssetsReady] = useState(isMockEnvironment);
  const [darkDecoded, setDarkDecoded] = useState(false);
  const [lightDecoded, setLightDecoded] = useState(false);
  const intro = useSharedValue(0);
  const opacity = useSharedValue(1);
  const showContent = ready || !!error;

  useEffect(() => {
    if (isMockEnvironment || assetsReady) return;
    if (darkDecoded && lightDecoded) {
      setAssetsReady(true);
    }
  }, [assetsReady, darkDecoded, lightDecoded]);

  useEffect(() => {
    if (isMockEnvironment || assetsReady) return;
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) setAssetsReady(true);
    }, 1200);

    void preloadCriticalAssets().finally(() => {
      if (mounted) {
        clearTimeout(timer);
        setAssetsReady(true);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [assetsReady]);

  useEffect(() => {
    if (!nativeLaunch || !showContent || !contentLaidOut || !assetsReady || dismissed) return;
    let mounted = true;
    void nativeLaunch
      .hide(reduced)
      .catch((error) => console.warn('[Anything startup] Custom launcher could not hide', error))
      .finally(() => {
        if (mounted) setDismissed(true);
      });
    return () => {
      mounted = false;
    };
  }, [showContent, contentLaidOut, assetsReady, reduced, dismissed]);

  useEffect(() => {
    if (nativeLaunch || !artReady || !artLaidOut) return;
    intro.set(
      withTiming(
        1,
        {
          duration: reduced ? 0 : 420,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
        },
        (finished) => {
          if (finished) scheduleOnRN(setIntroFinished, true);
        },
      ),
    );
    return () => cancelAnimation(intro);
  }, [artReady, artLaidOut, reduced, intro]);

  useEffect(() => {
    if (nativeLaunch || !showContent || !contentLaidOut || !introFinished || !assetsReady) return;
    // Keep the bitmap mounted until the fade ends; unmounting first can clear exit frames.
    opacity.set(
      withTiming(0, { duration: reduced ? 0 : 180 }, (finished) => {
        if (finished) scheduleOnRN(setDismissed, true);
      }),
    );
    return () => cancelAnimation(opacity);
  }, [showContent, contentLaidOut, introFinished, assetsReady, reduced, opacity]);

  const artworkStyle = useAnimatedStyle(() => ({
    transform: reduced
      ? []
      : [{ scale: 0.98 + intro.get() * 0.02 }],
  }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0d0f' }}>
      {showContent && (
        <View
          style={{ flex: 1 }}
          pointerEvents={dismissed ? 'auto' : 'none'}
          accessibilityElementsHidden={!dismissed}
          importantForAccessibility={dismissed ? 'auto' : 'no-hide-descendants'}
          onLayout={() => setContentLaidOut(true)}
        >
          {children}
        </View>
      )}
      {!nativeLaunch && !dismissed && (
        <Animated.View
          collapsable={false}
          onLayout={() => setArtLaidOut(true)}
          accessibilityViewIsModal
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#0d0d0f', zIndex: 1, elevation: 24 },
            coverStyle,
          ]}
        >
          <StatusBar hidden />
          <Animated.Image
            source={artwork}
            resizeMode="cover"
            fadeDuration={0}
            onLoad={() => setArtReady(true)}
            onError={() => {
              console.warn('[Anything startup] Splash artwork could not load');
              setArtReady(true);
            }}
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }, artworkStyle]}
          />
        </Animated.View>
      )}
      {!dismissed && !isMockEnvironment && (
        <View
          style={preheatContainerStyle}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {CRITICAL_ASSETS.map((asset, index) => (
            <Image
              key={index}
              source={asset}
              fadeDuration={0}
              onLoad={() => {
                if (index === 0) setDarkDecoded(true);
                if (index === 1) setLightDecoded(true);
              }}
              onError={() => {
                if (index === 0) setDarkDecoded(true);
                if (index === 1) setLightDecoded(true);
              }}
              style={preheatImageStyle}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const preheatContainerStyle = {
  position: 'absolute' as const,
  top: -200,
  left: -200,
  width: 2,
  height: 2,
  opacity: 0.01,
  overflow: 'hidden' as const,
};

const preheatImageStyle = {
  width: 2,
  height: 2,
};
