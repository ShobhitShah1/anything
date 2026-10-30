# Anything · native mobile

**Good finds. Yours to keep.**

A native Expo / React Native app for the same collection as Anything on the web. The screens use React Native views, Expo Router, native SwiftUI/Compose settings controls, FastImage, and Reanimated. Links open in a system browser panel inside the app. There is no WebView, embedded web page, or CSS/Tailwind screen layer.

## Run

Requires Node.js 24+, Corepack/Yarn, and an Anything native development build.

```bash
yarn install
yarn android
```

Start an Android emulator or connect an Android device before running `yarn android`. This compiles and installs the native development client. For later JavaScript changes, run `yarn start` and open the installed Anything app; this always selects the development client. Expo Go is not used by these commands. This project targets Android and iOS only.

The mobile folder is an independent Yarn project with its own lockfile and the `node-modules` linker required by native tooling. Yarn resolutions preserve the Firebase gRPC dependency fix. The Enriched Markdown install script is explicitly enabled to download its native syntax-highlighting assets.

FastImage, Expo WebBrowser, and Enriched Markdown require a native rebuild after installation. Enriched Markdown renders streaming responses and saved Markdown with native text, horizontally scrolling tables, task lists, and syntax-highlighted code blocks. Use the pencil in quick add to edit the Markdown source, or the eye to return to its formatted preview. Checkboxes display the saved state; change them in the source editor. Math and video modules are excluded to keep the binary smaller.

On this computer, a standalone copy lives at `C:\Users\Preneel\Desktop\AnythingMobile`. Dependencies are already installed there after setup. Open a terminal in that folder and run the commands above. The source copy in the Anything repository is `mobile/`; the two folders are independent.

## Launch splash

Android uses the local `modules/anything-launch` module, without Expo SplashScreen. `MainActivity` attaches an `ImageView` containing the approved artwork directly to the window before React draws. It fills the entire window with `CENTER_CROP`, plays a 420 ms settle, and stays in place until collection storage and the first React view are ready. Native code then fades it out for 180 ms and releases the bitmap. Reduced motion skips the animation. A storage error reveals the retry screen instead of trapping the user behind the artwork.

Android 12+ still creates a system starting window. The custom launch theme gives it a transparent drawable instead of the app icon and the same charcoal background. The first Activity frame displays the full artwork. The JavaScript artwork animation remains as a fallback for iOS and development clients that do not yet contain the custom Android module.

If building locally with an existing `android/` directory, run `npm run prepare:android` before your build. The plugin removes the old Expo splash registration and applies the custom launch theme. This synchronizes configuration without compiling or installing the app. EAS generates the ignored native project automatically. The replacement native launcher requires a new binary; testing JavaScript in an old client does not verify the replacement native code. Verify a cold launch from the installed preview/release app icon, rather than Fast Refresh or returning to an already open app.

## Icon and splash artwork

The selected brand is the custom lowercase “a” with a folded corner, in neutral off-white and grey on `#0d0d0f`. `assets/app-icon-mark.png` is the single transparent source for launcher icons, the in-app mark, web branding and the splash emblem. Theme-aware marks use its alpha silhouette so the same shape remains visible in light and dark themes. The generator creates the required iOS/store, Android adaptive/monochrome and web sizes; superseded mascot and Fold assets have been removed. The text-free splash places the selected mark on solid charcoal and settles/fades into the loaded app. Run the generator with `-NativeOnly` only when deliberately updating native icon sizes without rewriting website or splash assets.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-icons.ps1` from `mobile/` to regenerate native icons, web icons and both copies of the splash bitmap. Afterward run `npm run prepare:android` to sync an existing generated Android project, then build when ready. JavaScript reloads cannot update an installed launcher icon or native splash.

## Smaller release output

From `mobile/`, run `yarn compress` (or `npm run compress`) to export the Android JavaScript bundle with production minification and Hermes bytecode into ignored `dist/`. This exports JavaScript and assets; it does not rebuild or compress an installed APK.

For the Play Store, `yarn build:android:small` (or `npm run build:android:small`) starts the existing production EAS profile and produces an Android App Bundle. Play delivers device-specific packages instead of a universal development APK. Expo build properties enable release code and resource shrinking. No native source patch or experimental bundler flags are required.

Release JavaScript bundles are compressed as well. This reduces packaged bytes but can add startup decompression work, so compare cold starts on release builds. React Native's unused GIF and WebP decoders are disabled; saved media uses FastImage. React Native Image renders bundled PNG artwork, including the subscription scenery.

For a smaller sideloaded APK, `yarn build:android:apk:small` selects the opt-in `preview-arm64` profile. It targets **64-bit ARM devices only** and compresses native libraries. Other build profiles retain all default architectures and normal native-library packaging. Compressed native libraries make the APK download smaller, but Android may extract them during installation; this is not the same as reducing installed size. Use the production AAB for Google Play.

The Pro artwork keeps the original PNG for reliable native rendering. Unused eclipse/voyager design alternatives were removed from `assets/pro-space/`. App icon source files and iOS icons remain because icon generation and iOS builds need them. `expo-linking`, `@expo/metro-runtime`, and `expo-asset` are required by Router/Expo even where the app does not import them directly; `expo-dev-client` remains for the development profile. No installed runtime library was confirmed unused.

The size audit produced a signed **19.78 MiB ARM64 APK** at ignored `artifacts/anything-compact-arm64.apk`, before the subscription PNG compatibility fix and formatted card previews. That file is not a build of the latest source. The previously saved universal APK was 107.03 MiB, but it includes four architectures and was built earlier, so these are not a controlled same-commit comparison. Removing unreferenced design alternatives cleans the repository; those alternatives were already absent from Metro's bundle. Device rendering and cold-start performance still need verification in a current release build.

## What works locally

- Centered welcome, animated vector logo, Google-first action, and an account-free start.
- The same light and matte black palettes as the web, or follow-device appearance; native safe areas and navigation.
- A virtualized FlashList masonry gallery, compact list and focus layouts, search, type filters, quiet pin markers, tags, and folders.
- Native capture screen for notes, checklists, links/social posts, photos, Markdown, code, and masked secrets. Automatic capture detects pasted content; quick add accepts multiple links and skips duplicates.
- FastImage disk/memory caching, uncropped image display, copy/share actions, and in-app browser links.
- Save immediately, then fetch metadata in the background using the same five-second deadline and preview providers as the web app. Refresh preview bypasses the cache.
- JSON import/export compatible with the web app’s saves. Imports merge by ID and validate records before changing the collection. Exports contain saves, not folder definitions.
- Optional clipboard capture only while the app is active. It is off by default; the OS may request permission. It does not monitor other apps in the background.

Collection writes use small storage chunks and publish a new index only after all chunks are written, avoiding Android’s per-row limit for large image saves. Failed writes keep the previous collection and leave the draft open. The app waits for storage hydration before deciding which screen to show.

## Google login and Firebase

The Firebase JavaScript client and native Google ID-token sign-in are integrated. Existing web Firebase configuration is mapped to `EXPO_PUBLIC_FIREBASE_*` in the ignored `.env` file on this computer. A fresh clone should copy `.env.example` to `.env` and fill in its public client configuration.

**Google login on iOS/Android requires a development or production build. It cannot run inside Expo Go.** Guests can keep up to 10 local finds. Adding more asks for free Google sign-in and preserves the draft; editing and deleting existing finds remain available. Imports and automatic clipboard saves follow the same limit. Non-subscribers see a Go Pro chip in the collection header, with Google sign-in first for guests. Pro accounts replace that chip with a gold profile border and crown; they manage membership from Settings. Successful Google sign-in automatically enables cloud sync for that account; cancelling sign-in leaves sync unchanged.

1. Use the same Firebase project as the web app. Enable Google in Authentication, create a Standard `(default)` Firestore database, and publish the supplied private rules and index exemptions at `../firestore.rules` and `../firestore.indexes.json`.
2. In that project’s Google Cloud/Firebase console, register the Android package **`app.anything.mobile`** and add the SHA-1 fingerprint for the signing key of the build you install. Debug, EAS, and Play-distributed builds may use different certificates.
3. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the OAuth client ID of type **Web application**, from that same project. This is an OAuth client ID ending in `.apps.googleusercontent.com`, not the Firebase app ID or API key.
4. For iOS, register bundle ID **`app.anything.mobile`**. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and its reversed client ID in `GOOGLE_IOS_URL_SCHEME`. The latter enables the Google URL-scheme config plugin. Rebuild after changing it.
5. Restart Expo after changing `.env`, and create/install a development build:

   ```bash
   npx expo run:android
   # iOS local builds require macOS + Xcode:
   npx expo run:ios
   ```

   On Windows, install the project-local Ninja tool before the first local Android build:

   ```powershell
   powershell -NoProfile -File scripts/install-ninja.ps1
   npx expo prebuild --platform android
   npx expo run:android
   ```

   The config plugin uses Ninja 1.13.2 for the app’s CMake build when that local tool is present. This handles React Native code-generation paths exceeding Windows’ old 260-character limit without changing the shared Android SDK. The tool is ignored by Git; Linux/macOS and cloud builds use their normal toolchain.

   For a cloud development build, sign in to your Expo account and link the project, then use the supplied `eas.json`:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   npx eas-cli@latest build --platform android --profile development
   ```

6. Sign in, open **Settings → Cloud sync**, and enable it. Signing in alone does not upload data. Both apps then use `users/{uid}/collection/*`; local-only saves merge on initial sync, edits persist in a retry journal, and deletions use tombstones. Turning sync off or signing out keeps local saves.

The OAuth mobile client IDs/signing fingerprints must be supplied for the user’s Firebase project; they cannot be inferred from the web config. Google login and a live two-device sync need verification after that setup. No Firebase admin/service-account key belongs in this client app.

### Sync troubleshooting

- **Connecting for too long:** create the default Firestore database in the correct project and publish the private rules. After 15 seconds, the app reports the problem and offers Retry.
- **Permission denied:** check the private rules and the account/project. Do not enable public database access.
- **Google developer/configuration error:** verify the Web OAuth client, Android package and signing SHA-1, or iOS client and reversed URL scheme; rebuild after native configuration changes.
- **Large image cannot sync:** Firestore records over 900 KB are rejected while the save stays on this device. Use a hosted image URL. Firebase Storage upload is not implemented.

## Private Android signing

The Android package and iOS bundle ID are `app.anything.mobile`.

Local debug and release builds both use `credentials/anything-release.jks`, alias `anything-release`. Passwords and the EAS key mapping are in `credentials.json`. Both paths are ignored by Git. The signing plugin survives prebuild and stops local builds when credentials are missing instead of silently using the template debug key. EAS Android profiles also select these local credentials.

Back up the JKS and credentials JSON together in a password manager or encrypted backup. Restore both for a fresh clone; never regenerate a published app's signing identity. The Desktop copy uses the same key. Keep passwords out of public Expo environment variables.

Register this package and these public fingerprints in Firebase, replacing the previous template values:

```text
SHA-1: 2D:A5:DA:B2:D3:5B:D7:D0:C3:46:D0:B8:E0:83:FE:79:D2:83:90:C3
SHA-256: C1:DE:55:63:B7:C5:54:73:A3:9B:E4:0D:3C:13:99:FB:41:1A:5F:3D:30:5B:5B:6D:CC:68:23:7E:9C:85:7B:14
```

Then provide the project's Web OAuth client ID for native Google login. Google Play App Signing can use a separate distribution certificate; add its fingerprints for Play installs. Cloud builds need Firebase/OAuth public environment variables configured in EAS as well as the local signing files.

Signing follows [Expo local credentials](https://docs.expo.dev/app-signing/local-credentials/). No cloud build or store submission has been triggered.

## Builds and checks

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run export:android
npx expo export --platform ios --output-dir dist-ios
npx expo-doctor
```

Bundle exports verify JavaScript/assets, not a signed installable app. For an installable Android APK, use a local Android build or `npx eas-cli@latest build --platform android --profile preview`. Store releases need the production profile, signing, store metadata, and an Expo account. No app has been submitted to a store.

Type checking gives Node a larger stack because the SDK’s combined native UI types exceed the Windows default. The native Markdown renderer uses a maintained Markdown-it override; the Firebase gRPC override matches the web project.

## Platform and privacy limits

### Quick Add AI and Anything Pro

For the full store-to-backend setup, key locations, and sandbox-to-production flow, follow [PURCHASES.md](PURCHASES.md).

The membership screen uses the current RevenueCat offering and actual localized store prices. There is no dummy pricing or preview mode. Home's Go Pro entry and Settings → Anything Pro open the same custom screen. Configure the real store products, `anything_pro` entitlement, offering, SDK keys, backend, and legal pages before enabling checkout. The `store-test` EAS profile creates a store AAB using preview environment values; production uses a separate environment/backend.

AI generation now uses a Cloudflare Worker on its free tier, with usage in Firestore. Firebase Functions/Blaze are not required. Provider keys belong in Worker secrets, never `EXPO_PUBLIC_` variables. See [the backend setup guide](../worker/README.md) for multiple-key fallback, deployment, RevenueCat/store products, pricing, and the required mobile environment variables.

Signed-in users receive three successful free generations in total. Anything Pro includes 100 responses per UTC calendar month. The subscription screen uses real store prices and includes restore and subscription management. Local saves and native progressive voice-to-text remain free. Billing requires a rebuilt native app and configured store products; it does not work through an OTA update alone.

Quick Add streams responses into the editor, preserves partial drafts on interruption, and keeps the original request available through Undo. Nothing is saved until you tap Save. Automatic clipboard capture stays quiet, including when content is already in the collection; explicit saves still give feedback.

- Browser-extension right-click saving is a desktop Chrome/Edge feature. This app does not install a mobile share-sheet extension or a global clipboard service.
- Local collections and secret fields are not encrypted by this app. Device storage is removed by uninstalling. Cloud access is private to the authenticated account, but synced secrets are not end-to-end encrypted.
- Link metadata sends URLs to Microlink, FxTwitter, or Noembed as appropriate; remote images load from their hosts. Preview availability and provider rate limits vary.
- Native logo motion runs through Reanimated/SVG, pauses for reduced-motion preferences, and stays separate from collection/image layout. Native stack transitions handle navigation.
- `npm audit` currently reports transitive high-severity advisories in Expo/Metro tooling (`braces` and `node-forge`), without a compatible patched version offered by the registry. Do not use `npm audit fix --force` to downgrade the SDK. Recheck these before a production release.

## Source layout

`src/theme.ts` owns the palette, typography, and spacing. `src/app/` contains native routes; `src/components/` contains native UI; `src/state/` owns serialized local writes and sync; `src/services/` connects Firebase and platform-specific Google login; `src/shared/` holds the existing web app’s data types, detection, preview, and sync logic. Tests cover malformed data, safe URLs, chunked storage failures, draft creation, cloud merging, retries, and deletion behavior.
