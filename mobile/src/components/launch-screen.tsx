import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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

const nativeLaunch = Platform.OS === 'android' ? AndroidLaunch : null;
const artwork =
  Platform.OS === 'android' && !__DEV__
    ? { uri: 'anything_launch_art' }
    : require('../../assets/splash-art.png');

export function LaunchScreen({ children }: { children: ReactNode }) {
  const { ready, error } = useCollection();
  const reduced = useReducedMotion();
  const [artReady, setArtReady] = useState(false);
  const [artLaidOut, setArtLaidOut] = useState(false);
  const [contentLaidOut, setContentLaidOut] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const intro = useSharedValue(0);
  const opacity = useSharedValue(1);
  const showContent = ready || !!error;

  useEffect(() => {
    if (!nativeLaunch || !showContent || !contentLaidOut || dismissed) return;
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
  }, [showContent, contentLaidOut, reduced, dismissed]);

  useEffect(() => {
    if (nativeLaunch || !artReady || !artLaidOut) return;
    intro.set(
      withTiming(
        1,
        {
          duration: reduced ? 0 : 720,
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
    if (nativeLaunch || !showContent || !contentLaidOut || !introFinished) return;
    // Keep the bitmap mounted until the fade ends; unmounting first can clear exit frames.
    opacity.set(
      withTiming(0, { duration: reduced ? 0 : 240 }, (finished) => {
        if (finished) scheduleOnRN(setDismissed, true);
      }),
    );
    return () => cancelAnimation(opacity);
  }, [showContent, contentLaidOut, introFinished, reduced, opacity]);

  const artworkStyle = useAnimatedStyle(() => ({
    transform: reduced
      ? []
      : [{ translateY: (1 - intro.get()) * 8 }, { scale: 1 + (1 - intro.get()) * 0.04 }],
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
    </View>
  );
}
