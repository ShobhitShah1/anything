# Anything Pro: store setup and release testing

## Current readiness — 27 October 2026

The deployed Worker is reachable and correctly rejects unauthenticated requests with HTTP 401. Cloudflare lists all required secret names: `FIREBASE_SERVICE_ACCOUNT`, `GROQ_API_KEYS`, and `REVENUECAT_SECRET_API_KEY`. This confirms their presence, not their validity or RevenueCat project match.

**Live checkout is not ready in this working copy.** The Android/iOS RevenueCat public SDK keys and Terms/Privacy URLs in `mobile/.env` are empty. The owner confirmed these still need configuration. No real purchase, refund, renewal, or restore has been performed during this check. Production Firestore rules and RevenueCat/Play dashboard settings have not been verified remotely.

After a successful checkout or restore, the app now retries server confirmation with 1, 2, and 4 second pauses, within a 15 second verification budget. It cancels verification when the membership screen closes. Store-confirmed access blocks another checkout even if server verification is delayed; the user gets a refresh/restore message rather than a request to pay again.

## Where the data lives

- **Google Play / Apple App Store:** the checkout, payment method, actual charge, store transaction, renewal, cancellation and refund. Anything does not collect or store card numbers or CVV.
- **RevenueCat:** the subscriber's purchase/receipt and entitlement history. Its App User ID is the signed-in **Firebase UID**. This is the subscription authority; there is no separate `payments` ledger or purchase webhook in this repository.
- **Firebase Authentication, project `anything-66dbd`:** the signed-in identity. The app configures/logs into RevenueCat using that UID, and the Worker authenticates the Firebase ID token before checking access.
- **Cloud Firestore `users/{uid}/collection/{record}`:** synced saved items and folders. This collection does not store payment methods or purchase receipts.
- **Cloud Firestore `aiUsage/{uid}`:** free and paid response counts, the UTC calendar month, and an expiring reservation for an in-flight AI response. The Worker writes these with its service account. The rules in this repository do not grant clients direct access to this path.
- **On the device:** collection data and appearance preferences are kept in chunked AsyncStorage. RevenueCat also maintains its own SDK customer-info cache; that cache is not the server's authority for paid AI access.
- **Cloudflare Worker `anything-ai`:** verifies identity and fetches the current RevenueCat `anything_pro` entitlement on AI status/generation requests. Provider keys, the RevenueCat server key and Firebase service-account JSON belong in Worker secrets, never public app environment variables. No card data is stored in the Worker.

The purchase flow is **store checkout → RevenueCat entitlement → authenticated Worker verification → Firestore usage allowance**. It is intentionally pull-based: no duplicate entitlement table or webhook is required for request-time access checks. Configure Google Play real-time notifications and App Store server notifications in RevenueCat so refunds and renewals reach RevenueCat promptly. Cancellation normally leaves access available until the paid expiration; expiration/revocation removes it once reflected by RevenueCat. The Worker honors a reported grace-period expiration.

## Owner actions before accepting payments

1. Create/activate the real subscription products and base plans in the correct Play/App Store app. Connect store credentials and server notifications to the same RevenueCat project.
2. Attach those products to the exact entitlement **`anything_pro`**, and to monthly/yearly packages in the **current offering**. The app uses localized prices from those packages.
3. Set `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`) and, for iOS, `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (`appl_…`). Put the same values in the EAS environment used for the release; `.env` alone does not configure a cloud build.
4. Confirm `REVENUECAT_SECRET_API_KEY` is a server API key from that same RevenueCat project and can access the v1 subscriber endpoint. Keep `ALLOW_SANDBOX_PURCHASES=false` in production. Never change production to accept sandbox access just to make a test pass.
5. Deploy/check the Firestore rules and verify the Worker service account has the intended database permissions. Review customer purchase history in the RevenueCat dashboard, and actual charges/refunds in Play Console or App Store Connect.
6. Follow the isolated sandbox setup below and test a store-distributed build: successful purchase, pending payment approval, cancelled checkout, reinstall/restore, account change, refund/revocation, renewal, offline/server failure after checkout, and the 100-response limit. A local code test does not replace these store tests.

The offer is **3 successful free AI responses per account**, then **100 successful paid AI responses per UTC calendar month**. Paid quota resets on the first of the month, not on each purchase anniversary; a yearly plan still receives the monthly allowance. Failed generation does not spend quota. An expired subscription returns to whatever free allowance remains, without resetting it. The app cannot guarantee paid AI generation offline because identity, entitlement and quota are checked on the server.

References: [RevenueCat customer information](https://www.revenuecat.com/docs/customers/customer-info), [Google real-time notifications](https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications), [RevenueCat user identity](https://www.revenuecat.com/docs/customers/identifying-customers).

The app uses our custom React Native membership screen and `react-native-purchases`. Production uses real store prices and memberships, with no fallback products. Missing store products show an unavailable state. Signed-in development builds have **Enable Pro for my profile** in Settings only. This session-only, account-scoped preview updates the gold profile crowns, Settings membership card and member screen with 100 responses. It changes no stored collection data, RevenueCat entitlement, purchase, or backend AI allowance, and can be disabled from Settings. Real membership changes also update the shared profile status. The entitlement checked by both the mobile app and Worker is **`anything_pro`**.

## Will new subscription IDs appear automatically?

**No SKU list is passed from the app.** The screen calls `getOfferings()` and displays supported products in `offerings.current.availablePackages`. It displays the store's localized price and billing period and purchases that exact package. Yearly appears before Monthly. Only subscriptions with a real one-month (`P1M`) or one-year (`P1Y`) duration and a price are supported.

The required connection is:

**Store product + base plan → RevenueCat product → current offering package → app**

And for access:

**Store product → `anything_pro` entitlement → Firebase UID → Worker verification**

Creating an ID in Play Console or RevenueCat alone does not add it to the screen. Import the real store product, attach it to the entitlement, add it to the current offering, and activate its store plan/countries. It appears on the next successful screen refresh; cached offerings/store propagation mean it is not an immediate live dashboard push. Changing products/prices in this offering does not require a new app build. Changing public SDK keys, package/bundle IDs, or native libraries does require the appropriate new build.

[RevenueCat offerings](https://www.revenuecat.com/docs/offerings/overview), [product configuration](https://www.revenuecat.com/docs/offerings/products-overview).

## 1. Exact identifiers for a new setup

Both app identifiers already equal **`app.anything.mobile`**. Keep that package/bundle ID and its signing identity.

Suggested **Google Play** setup:

- Subscription product ID: **`anything_pro`**.
- Monthly auto-renewing base-plan ID: **`monthly`**, one month.
- Yearly auto-renewing base-plan ID: **`yearly`**, one year.
- RevenueCat's imported Android products will identify the subscription/base-plan pairs, commonly **`anything_pro:monthly`** and **`anything_pro:yearly`**. Prefer RevenueCat's product importer. For manual entry, supply the subscription ID and base-plan ID in their respective fields.

Suggested **Apple** setup, when shipping iOS:

- Subscription group: **Anything Pro**, both products at the same service level.
- Monthly product ID: **`app.anything.mobile.pro.monthly`**.
- Yearly product ID: **`app.anything.mobile.pro.yearly`**.

In **RevenueCat → Product catalog**:

1. Create entitlement **`anything_pro`** and attach all supported real-store products.
2. Create an offering, for example **`default`**, and mark it as the project's **Default/current offering**.
3. Add standard **Monthly** package **`$rc_monthly`** and **Annual** package **`$rc_annual`**. Attach the equivalent product for each platform to its package.
4. Set restore behavior to **Keep with original App User ID**. The app uses the signed-in Firebase UID for checkout and restore; customers must sign into that account again.

These suggested permanent product IDs are **not hardcoded**. If you already created different real IDs, keep them and import/attach those instead. Never recreate an existing subscription merely to match these suggestions. If earlier products used the entitlement `anything_plus`, attach them to `anything_pro` before deploying this version so existing purchasers retain access. The app supports custom package identifiers too, provided their store product has a supported duration; package names never invent a billing period.

Both plans grant 100 successful AI responses per **UTC calendar month**, including the yearly plan. Unused responses do not roll over. Three successful free responses are a one-time app allowance per Firebase account, not a store free trial. Local collections and progressive dictation stay free. Configure ordinary auto-renewing base plans without introductory offers, free billing trials, prepaid plans, or installment commitments for this version; their special disclosures are not implemented.

## 2. Google Play and RevenueCat credentials

1. Create/select the Play Console app with package **`app.anything.mobile`**, finish its required merchant/payment setup, and upload a signed AAB when required to recognize the package.
2. Create the subscription and its two base plans. Set actual prices, available countries, and activate both base plans.
3. Add a **Google Play** app with that exact package to the RevenueCat project.
4. Follow [RevenueCat's current Play service credentials guide](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials). Generate the service-account JSON, enable the specified APIs, grant its email the specified app permissions in Play Console, upload that JSON to RevenueCat, and run its credential validator. New credentials can take up to 36 hours to become valid.
5. Import the two real base-plan products and connect them to the entitlement/packages above.
6. Connect Google real-time developer notifications to RevenueCat using its dashboard setup. This improves renewal/cancellation/refund updates. A RevenueCat-to-Worker webhook is not required; the Worker checks RevenueCat on requests.

**This Google Play service-account JSON is not the Firestore Worker JSON.** They have different jobs and permissions. Neither belongs in mobile environment variables or source control.

## 3. Keys and URLs required before building

Add these public settings in the correct **EAS project environment** and in local `mobile/.env` when working locally:

```dotenv
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_YOUR_ANDROID_PUBLIC_SDK_KEY
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_YOUR_IOS_PUBLIC_SDK_KEY
EXPO_PUBLIC_AI_URL=https://YOUR_WORKER.workers.dev/ai
```

Replace every placeholder with your real value. The iOS key is needed only when building iOS. Keep the existing Firebase/Google login variables from `.env.example` in each matching EAS environment too. The app and Worker must use the same Firebase Auth project.

- `store-test` uses EAS environment **preview**, with real `goog_`/`appl_` keys and a **staging Worker**.
- `production` uses EAS environment **production**, with real platform keys and the **production Worker**.
- Both are release builds. The local Test Store key has been removed so this setup uses the real store keys. An optional `EXPO_PUBLIC_REVENUECAT_TEST_KEY` can be supplied explicitly for **debug development builds only**. It is never selected by a store build. RevenueCat Test Store purchases do not create real Play/App Store products.
- Public SDK keys are safe to embed. Never put RevenueCat server secrets, Groq keys, service-account JSON, or `.p8` files in `EXPO_PUBLIC_` variables.
- Local `.env` is ignored by Git and is not automatically uploaded to EAS. Set cloud build values through the Expo dashboard's Environment Variables screen. An env/key change requires a new store build for this setup.
- Checkout requires a successful server usage/access check. Remaining free responses do not block upgrading. Terms and Privacy links use the product website by default; optional `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL` values override them. The free-response footer remains removed.

Verify platform SDK keys and the AI URL in the selected EAS environment before building. Local environment values do not verify the cloud build configuration.

[RevenueCat Test Store release restrictions](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## 4. Firestore and Worker secrets

Follow [the backend guide](../worker/README.md) to create the default Firestore database, configure the matching Firebase project/public API key in `worker/wrangler.jsonc`, and keep `aiUsage/*` server-only. No Firebase Functions/Blaze deployment is required. Cloudflare/Firestore free quotas still apply.

Private Worker secrets:

- **`REVENUECAT_SECRET_API_KEY`**: a server API key compatible with RevenueCat's v1 subscriber lookup, from the same project as the mobile SDK keys. Not the public `test_`/`goog_`/`appl_` key.
- **`GROQ_API_KEYS`**: comma-separated provider keys, primary first.
- **`FIREBASE_SERVICE_ACCOUNT`**: the entire private JSON for a dedicated Firestore service account.

To obtain the Firestore JSON: Google Cloud Console → select the Firebase project → **IAM & Admin → Service Accounts → Create service account**, name it `anything-worker`, grant **Cloud Datastore User**, then **Keys → Add key → Create new key → JSON**. Store the downloaded file outside the repository. This role has broader document access than just usage records; use a separate Firebase project for staging. Do not grant Owner/Editor. If organization policy blocks key creation, ask the administrator for an allowed credential method.

Upload the complete file, not its path or just the private-key field:

```powershell
Set-Location -LiteralPath 'C:\AnyThing\worker'
Get-Content -Raw -LiteralPath 'C:\private\anything-worker.json' |
  npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret list
npm run deploy
```

Replace the file path. Leave the other two secrets in place if already added. `secret list` shows names, not values. The equivalent interactive command is `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT`, with the entire JSON as its input. This is **not** `google-services.json` or the Firebase web API key.

For store sandbox testing, use an isolated staging Worker and Firebase project with **`ALLOW_SANDBOX_PURCHASES=true`** on that Worker only; its mobile Auth configuration must match. Keep the production Worker's existing **false** value. Otherwise a test checkout can succeed in the SDK while the production Worker correctly refuses paid AI access. Add all three secrets separately to the staging Worker too. Never point the public release at the staging backend.

## 5. Build and upload for Google Play testing

From `mobile/`, link the intended existing Expo project before building:

```powershell
npx eas-cli@latest login
npx eas-cli@latest project:info
# If not linked, initialize/link the intended project:
npx eas-cli@latest init
```

For this dynamic `app.config.ts`, if EAS asks for a manual update, add the **actual returned project ID** as `extra.eas.projectId`; do not invent an ID. Supply environment values in the linked project. Preserve local `credentials.json` and its referenced JKS: both profiles currently use `credentialsSource: local`. Do not upload a newly generated signing identity over an existing app.

Build the store-testing AAB:

```powershell
npx eas-cli@latest build --platform android --profile store-test
```

This profile inherits the production **app-bundle**, store distribution, and automatic version increment, but reads the **preview** EAS environment. Unlike the existing preview APK profile, its AAB is suitable for Play Console. Remote version management prevents repeated build numbers; if an app version was previously uploaded, initialize the EAS remote version counter from its latest version before building (`npx eas-cli@latest build:version:set --platform android`).

Upload the resulting AAB manually to **Play Console → Testing → Internal testing**, or configure EAS's Google Play submission service-account credential and run:

```powershell
npx eas-cli@latest submit --platform android --profile internal
```

Choose the exact `store-test` build when prompted. Do not blindly submit an unrelated latest build. The configured submission creates a **draft internal release**; review and complete it in Play Console. EAS Submit credentials are a separate permission concern from RevenueCat receipt-validation credentials. This change has not built, uploaded, or released anything.

For the public release, configure production EAS values and the production backend, then build with `--profile production`. Do not promote a `store-test` binary pointing to staging into production: build a production binary instead.

[Expo Play submission/AAB guidance](https://docs.expo.dev/submit/android/), [EAS app version management](https://docs.expo.dev/build-reference/app-versions/).

## 6. Tester setup and expected purchase flow

1. Add the tester's Google account to the Internal testing list and complete the tester opt-in link. Install **from that Play Store link**, not a sideloaded debug APK.
2. Also add that account to **Play Console → Settings → License testing** and select/save its email list. Internal-track access alone does not make purchases free. Check that the store sheet offers Google's sandbox payment methods.
3. Verify Google sign-in for the Play-signed build. Register the **Play App Signing certificate SHA-1** with the Firebase/Google Android OAuth configuration, not just the local/upload certificate. The Web OAuth client ID must still belong to the same Firebase project.
4. Sign into Anything. Open Home **Go Pro** or Settings **Anything Pro**. Localized monthly/yearly prices load from the current offering after sign-in.
5. Select a plan. The Google Play purchase sheet confirms the actual amount and period. Cancel leaves the draft untouched; pending approval does not grant access or allow another checkout attempt.
6. On success, RevenueCat's customer record should use the exact **Firebase UID**, and its active entitlement must be **`anything_pro`**. The staging Worker independently verifies the entitlement before granting 100 monthly responses.
7. If the store confirms purchase but access is still verifying, use Refresh or Restore after correcting configuration. **Do not buy again.** Back returns to the preserved draft; the purchase does not submit it automatically.
8. Verify restore on the same Firebase/store accounts, another Firebase account, expiry, cancellation, renewal, refund, free-three enforcement, failure release, and the monthly cap. Canceling renewal retains access through the paid expiry. Reinstalling does not reset server usage.

No device testing or purchase verification was performed by the coding agent, per your instruction. A passing build/code check cannot confirm store credentials, products, signing, or a real transaction.

[Official Google Play sandbox instructions](https://www.revenuecat.com/docs/test-and-launch/sandbox/google-play-store).

## 7. iOS when needed

Create the same-bundle App Store Connect app and auto-renewing subscription group/products above. Complete paid-app agreements, tax/banking, localizations, and review metadata. Connect an App Store app in the same RevenueCat project. Upload the **StoreKit 2 In-App Purchase `.p8` key**, Key ID, and Issuer ID from **Users and Access → Integrations → In-App Purchase** to RevenueCat; an old shared secret is not a substitute. Import and attach the products to `anything_pro` and the same current offering's packages.

Use the `appl_` public SDK key for both sandbox and production. A `store-test` iOS build can use the preview environment/staging backend and TestFlight; production must use the production environment/backend. Do not use the debug Test Store key in TestFlight. Native rebuilds are required; OTA updates cannot add the purchases module.

## Implementation and troubleshooting

- `src/services/billing.ts`: lazy SDK configuration, platform-key validation, development-only Test Store selection, serialized Firebase UID login, native-build guard, development logs.
- `src/utils/subscription-plans.ts`: current-offering package mapping; localized store prices only, no SKU allowlist, inferred prices, or dummy fallback.
- `src/utils/billing-config.ts`: exact entitlement and canceled/pending/error handling.
- `src/app/subscription.tsx`: custom paywall, purchase/restore/manage, customer-info listener with cleanup, foreground refresh, server verification, usage and renewal date.
- `worker/src/access.ts`: entitlement validation, production sandbox rejection, free and paid quotas. No client purchase flag grants paid AI access.

No plans: check **real platform SDK key → connected store credentials → active products/base plans/countries → entitlement → default/current offering packages**, then refresh. Missing SDK key/backend prevents checkout. Store-confirmed but unverified means fix entitlement/project/Firebase UID/staging flag, then refresh; it does not mean purchase again. No hosted RevenueCat paywall is installed. Customer Center is optional and currently requires RevenueCat Pro/Enterprise; direct store management and explicit Restore are already supported.
