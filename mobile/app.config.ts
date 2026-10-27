import type { ExpoConfig } from 'expo/config';
const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
const config: ExpoConfig = {
  name: 'Anything',
  icon: './assets/icon.png',
  slug: 'anything-mobile',
  scheme: 'anything',
  version: '1.0.0',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  ios: {
    bundleIdentifier: 'app.anything.mobile',
    supportsTablet: true,
    icon: { light: './assets/icon-ios-light.png', dark: './assets/icon-ios-dark.png' },
  },
  android: {
    package: 'app.anything.mobile',
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      foregroundImage: './assets/icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#0d0d0f',
    },
  },
  plugins: [
    './plugins/with-android-launch.cjs',
    [
      'expo-build-properties',
      {
        android: { enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true },
      },
    ],
    './plugins/with-cmake.cjs',
    './plugins/with-signing.cjs',
    'expo-router',
    'react-native-fast-image',
    'expo-web-browser',
    'expo-asset',
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Use your microphone to dictate text in Anything.',
        speechRecognitionPermission: 'Turn your speech into text as you speak in Anything.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose an image to save in your Anything collection.',
        cameraPermission: false,
      },
    ],
    ...(iosUrlScheme
      ? [
          ['@react-native-google-signin/google-signin', { iosUrlScheme }] as [
            string,
            Record<string, string>,
          ],
        ]
      : []),
  ],
};
export default config;
