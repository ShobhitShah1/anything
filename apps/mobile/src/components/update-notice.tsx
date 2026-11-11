import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Updates from 'expo-updates';
import { RotateCw } from 'lucide-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../state/collection';
import { type } from '../theme';

export function UpdateNotice() {
  const { colors, dark } = useCollection();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sheetWidth = Math.min(width, 520);
  const reducedMotion = useReducedMotion();
  const checking = useRef(false);
  const [restartError, setRestartError] = useState(false);
  const { isRestarting, isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || checking.current) return;

      checking.current = true;
      void Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch(() => {})
        .finally(() => {
          checking.current = false;
        });
    });

    return () => subscription.remove();
  }, []);

  if (__DEV__ || !Updates.isEnabled || !isUpdatePending) return null;

  return (
    <Modal
      accessibilityViewIsModal
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={() => {}}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: dark ? 'rgba(0,0,0,0.64)' : 'rgba(24,24,28,0.32)',
        }}
      >
        <View
          style={{
            width: sheetWidth,
            alignSelf: 'center',
            overflow: 'hidden',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderCurve: 'continuous',
            backgroundColor: colors.paper,
          }}
        >
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            fadeDuration={0}
            resizeMode="cover"
            source={
              dark
                ? require('../../assets/update-space-dark.png')
                : require('../../assets/update-space-light.png')
            }
            style={{ width: '100%', height: (sheetWidth * 450) / 1152 }}
          />

          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 22,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              gap: 10,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                ...type.title,
                color: colors.ink,
                fontWeight: '600',
              }}
            >
              Update ready
            </Text>
            <Text
              allowFontScaling={false}
              style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}
            >
              Restart to open the latest version.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restart Anything to apply the update"
              accessibilityState={{ disabled: isRestarting, busy: isRestarting }}
              disabled={isRestarting}
              onPress={() => {
                setRestartError(false);
                void Updates.reloadAsync().catch(() => setRestartError(true));
              }}
              style={({ pressed }) => ({
                minHeight: 54,
                marginTop: 10,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                borderRadius: 17,
                backgroundColor: colors.ink,
                opacity: pressed || isRestarting ? 0.78 : 1,
              })}
            >
              {isRestarting ? (
                <ActivityIndicator size="small" color={colors.canvas} />
              ) : (
                <RotateCw size={17} color={colors.canvas} strokeWidth={1.8} />
              )}
              <Text
                allowFontScaling={false}
                style={{ color: colors.canvas, fontSize: 15, fontWeight: '600' }}
              >
                Restart Anything
              </Text>
            </Pressable>

            {restartError && (
              <Text
                accessibilityRole="alert"
                allowFontScaling={false}
                style={{ color: colors.danger, fontSize: 13, lineHeight: 18 }}
              >
                Couldn’t restart. Try again.
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
