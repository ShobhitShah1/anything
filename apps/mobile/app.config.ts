import type { ExpoConfig } from 'expo/config';

const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
const compactApk = process.env.EAS_BUILD_PROFILE === 'preview-arm64';
const productionBuild = process.env.EAS_BUILD_PROFILE === 'production';
const productionEnvironment = productionBuild || process.env.APP_ENV === 'production';
const productionAndroidAppId = process.env.ADMOB_ANDROID_APP_ID;
const productionIosAppId = process.env.ADMOB_IOS_APP_ID;

const admobAndroidAppId = productionBuild
  ? productionAndroidAppId
  : 'ca-app-pub-3940256099942544~3347511713';

const admobIosAppId = productionBuild
  ? productionIosAppId
  : 'ca-app-pub-3940256099942544~1458002511';

const productionAdsReady =
  !!productionAndroidAppId &&
  !!productionIosAppId &&
  !!process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID &&
  !!process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID;

const config: ExpoConfig = {
  name: 'Anything',
  icon: './assets/icon.png',
  slug: 'anything',
  scheme: 'anything',
  version: '0.0.8',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: 'https://u.expo.dev/46845190-3f80-495e-ba63-a888e2fdb9c7',
  },
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
          cmakeVersion: process.platform === 'win32' ? '3.31.6' : undefined,
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
    ['expo-navigation-bar', { enforceContrast: false }],
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
    admobTestMode: !productionEnvironment,
    admobEnabled: !productionEnvironment || productionAdsReady,
    eas: { projectId: '46845190-3f80-495e-ba63-a888e2fdb9c7' },
  },
};

export default config;
