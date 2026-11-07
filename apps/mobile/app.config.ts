import type { ExpoConfig } from 'expo/config';
const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
const compactApk = process.env.EAS_BUILD_PROFILE === 'preview-arm64';
const productionBuild = process.env.EAS_BUILD_PROFILE === 'production';
const admobAndroidAppId = productionBuild
  ? process.env.ADMOB_ANDROID_APP_ID
  : 'ca-app-pub-3940256099942544~3347511713';
const admobIosAppId = productionBuild
  ? process.env.ADMOB_IOS_APP_ID
  : 'ca-app-pub-3940256099942544~1458002511';
const productionAdsReady =
  productionBuild &&
  !!admobAndroidAppId &&
  !!admobIosAppId &&
  !!process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID &&
  !!process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID;
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
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          enableBundleCompression: true,
          // Saved media uses FastImage/Glide; React Native Image only renders bundled artwork.
          gifEnabled: false,
          webpEnabled: false,
          extraProguardRules: '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
          // Keep Play's native library packaging and device support; compact APKs are opt-in.
          useLegacyPackaging: compactApk,
          buildArchs: compactApk ? ['arm64-v8a'] : ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
        },
      },
    ],
    './plugins/with-cmake.cjs',
    './plugins/with-fingerprint-fix.cjs',
    './plugins/with-signing.cjs',
    'expo-router',
    'react-native-fast-image',
    'expo-web-browser',
    'expo-asset',
    ...(admobAndroidAppId && admobIosAppId
      ? [
          [
            'react-native-google-mobile-ads',
            {
              androidAppId: admobAndroidAppId,
              iosAppId: admobIosAppId,
              delayAppMeasurementInit: true,
            },
          ] as [string, Record<string, unknown>],
        ]
      : []),
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
  extra: {
    admobTestMode: !productionBuild,
    admobEnabled: !productionBuild || productionAdsReady,
  },
};
export default config;
