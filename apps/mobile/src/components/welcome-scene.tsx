import { memo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { Action, GoogleMark } from './ui';
import { fonts } from '../theme';
import { WELCOME_SPACE_DARK, WELCOME_SPACE_LIGHT } from '../utils/preload-assets';

interface WelcomeSceneProps {
  onOpenCapture: () => void;
  topInset: number;
  captureInset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const WelcomeScene = memo(function WelcomeScene({
  onOpenCapture,
  topInset,
  captureInset,
  onScroll,
}: WelcomeSceneProps) {
  const state = useCollection();
  const { colors, dark, user, busy } = state;
  const { width, height } = useWindowDimensions();
  const imageSource = dark ? WELCOME_SPACE_DARK : WELCOME_SPACE_LIGHT;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* 1. Full-bleed pixel art: orbital satellite, diamond stars, outpost dome, rover & antenna */}
      <Image
        source={imageSource}
        resizeMode="cover"
        fadeDuration={0}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
        }}
      />

      {/* 2. Center Content Area (Typography & Actions) */}
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: Math.max(500, height),
            paddingTop: topInset + 20,
            paddingBottom: captureInset + 20,
          },
        ]}
      >
        <View style={styles.copyBlock}>
          <Text
            allowFontScaling={false}
            style={[
              styles.headline,
              {
                color: colors.ink,
                fontSize: width < 380 ? 32 : 36,
                lineHeight: width < 380 ? 38 : 44,
              },
            ]}
          >
            A space for <Text style={styles.headlineEmphasis}>everything.</Text>
          </Text>
        </View>

        <View style={styles.actionBlock}>
          {!user ? (
            <>
              {/* Prominent Google Sign-In Action (matches app design system, zero shadow, high contrast) */}
              <Action
                title={busy ? 'Connecting…' : 'Continue with Google'}
                leading={<GoogleMark />}
                disabled={busy}
                onPress={() => void state.signIn()}
              />

              {/* Start locally secondary action */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start on this device"
                onPress={onOpenCapture}
                style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.secondaryButtonText, { color: colors.muted }]}
                >
                  Start on this device
                </Text>
                <ArrowUpRight size={14} color={colors.muted} strokeWidth={1.8} />
              </Pressable>
            </>
          ) : (
            <>
              {/* Signed-in user with empty collection */}
              <Action title="Save your first find" onPress={onOpenCapture} />
              <Pressable
                accessibilityRole="button"
                onPress={onOpenCapture}
                style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.secondaryButtonText, { color: colors.muted }]}
                >
                  Or paste a link below
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  copyBlock: {
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
  },
  headline: {
    textAlign: 'center',
    letterSpacing: -1.2,
    fontWeight: '600',
    marginBottom: 0,
  },
  headlineEmphasis: {
    fontFamily: fonts.editorial,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  actionBlock: {
    width: '100%',
    maxWidth: 310,
    gap: 12,
    marginTop: 24,
  },
  secondaryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
