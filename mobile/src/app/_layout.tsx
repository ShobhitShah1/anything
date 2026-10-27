import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ActivityIndicator, Appearance, Pressable, Text, View } from 'react-native';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';
import { useReducedMotion } from 'react-native-reanimated';
import { CollectionProvider, useCollection } from '../state/collection';
import { Feedback, FeedbackHost } from '../components/feedback';
import { LaunchScreen } from '../components/launch-screen';

function Routes() {
  const state = useCollection();
  const segments = useSegments();
  const reduced = useReducedMotion();
  const { colors, dark, ready, error } = state;
  useEffect(() => {
    Appearance.setColorScheme(state.data.theme === 'system' ? 'unspecified' : state.data.theme);
    void SystemUI.setBackgroundColorAsync(colors.canvas).catch(() => {});
  }, [state.data.theme, colors.canvas]);
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          justifyContent: 'center',
          padding: 28,
          gap: 20,
        }}
      >
        {error ? (
          <>
            <Feedback message={error} error />
            <Pressable onPress={() => void state.reload()}>
              <Text allowFontScaling={false} style={{ color: colors.accent }}>
                Retry loading collection
              </Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.ink} />
        )}
      </View>
    );
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.canvas },
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 18, fontWeight: '500' },
          headerBackButtonDisplayMode: 'minimal',
          animation: reduced ? 'fade' : 'default',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'anything.' }} />
        <Stack.Screen
          name="capture"
          options={{
            title: 'New find',
            presentation: 'fullScreenModal',
            animation: reduced ? 'fade' : 'slide_from_bottom',
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen name="item/[id]" options={{ title: 'Your find' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen
          name="subscription"
          options={{ title: 'Anything Pro', presentation: 'modal' }}
        />
        <Stack.Screen name="folders" options={{ title: 'Folders' }} />
      </Stack>
      {segments[0] !== 'capture' && <FeedbackHost />}
    </>
  );
}
export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <CollectionProvider>
          <LaunchScreen>
            <Routes />
          </LaunchScreen>
        </CollectionProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
