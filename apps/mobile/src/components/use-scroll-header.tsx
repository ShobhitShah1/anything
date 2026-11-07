import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCollection } from '../state/collection';
import { HeaderBackTitle } from './ui';

export function useScrollHeader(title?: string) {
  const { colors, dark } = useCollection();
  const topInset = useHeaderHeight();
  const targetRef = useRef<ComponentRef<typeof View>>(null);
  const [scrolled, setScrolled] = useState(false);
  const lastScrolled = useRef(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 2;
    if (lastScrolled.current !== next) {
      lastScrolled.current = next;
      setScrolled(next);
    }
  }, []);
  const background = useCallback(
    () =>
      !scrolled ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }]} />
      ) : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <BlurView
            blurTarget={targetRef}
            intensity={40}
            tint={dark ? 'dark' : 'light'}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.canvas}E6` }]} />
        </View>
      ),
    [colors.canvas, dark, scrolled],
  );
  const options = useMemo(
    () => ({
      ...(title
        ? {
            title,
            headerTitle: '',
            headerBackVisible: false,
            headerLeft: () => <HeaderBackTitle title={title} />,
          }
        : {}),
      headerTransparent: true,
      headerStyle: { backgroundColor: scrolled ? 'transparent' : colors.canvas },
      headerBlurEffect: Platform.OS === 'ios' && scrolled ? ('systemMaterial' as const) : undefined,
      headerBackground: Platform.OS === 'ios' ? undefined : background,
    }),
    [background, colors.canvas, scrolled, title],
  );
  return { targetRef, topInset, onScroll, options };
}
