# Anything AI — Cloudflare Workers free tier + Firestore

Firebase Functions and Blaze are **not required**. This backend runs on Cloudflare Workers and stores usage in your existing Firestore database. The phone sends its Firebase ID token to `/ai`; the Worker validates it through Firebase Auth, checks RevenueCat, reserves usage with Firestore write preconditions, and streams the response. Three successful generations are free per Google account; Plus includes 100 per UTC calendar month. Parallel requests cannot spend the same allowance. Failed generations release the reservation. If a process is interrupted, its reservation expires after three minutes.

**Firestore alone cannot securely proxy AI.** Any provider key readable by the app can be extracted, even when its document is restricted to signed-in users. Store private keys in the Worker’s encrypted secrets; keep only account usage in Firestore. Local saves, quiet clipboard capture, and progressive native voice-to-text remain free and do not call this backend.

## Free-tier limits

Keep your Cloudflare account on **Workers Free** and Firebase on **Spark**. Cloudflare currently includes 100,000 Worker requests/day, with 10 ms CPU time/request. Time waiting for external APIs is not CPU time. Firestore's free default database includes 50,000 reads/day and 20,000 writes/day. This implementation caches Google OAuth tokens and batches stream updates to reduce CPU work, but long responses can still hit Worker resource limits; live CPU usage has not been measured. On free plans, exceeding a quota can stop requests. AI provider/search costs and store commissions are separate; do not assume paid AI usage is unlimited or free.

References: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).

## Add the keys

1. Create a free Cloudflare account and install the backend tooling: `npm --prefix worker ci`.
2. In `worker/wrangler.jsonc`, set `FIREBASE_PROJECT_ID` and the public `FIREBASE_API_KEY` from the same Firebase project used by the app. These two values are public configuration. Ensure the key permits Firebase Authentication API requests from your backend; a key restricted to only Android/iOS application requests will not work here.
3. In Google Cloud Console → IAM & Admin → Service Accounts, create a dedicated Worker service account in that project. Give it **Cloud Datastore User** access (or a narrower custom role for document read/create/update), then create/download its JSON private key. This is a powerful server credential: do not put it in the app, source control, chat, or a public folder. You do not need a Firebase Functions deployment or a Firebase billing upgrade for this.
4. In a terminal opened at `worker/`, sign in with `npx wrangler login`. Add the following **secrets**, using prompts or Cloudflare Dashboard → Workers & Pages → anything-ai → Settings → Variables and Secrets → Add → Secret:

```sh
npx wrangler secret put GROQ_API_KEYS
npx wrangler secret put REVENUECAT_SECRET_API_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
```

For `GROQ_API_KEYS`, enter one to ten comma-separated Groq keys, primary first. For `REVENUECAT_SECRET_API_KEY`, enter a RevenueCat secret API key with v1 subscriber-read access. For `FIREBASE_SERVICE_ACCOUNT`, enter the complete downloaded service-account JSON. You can safely pipe that JSON file directly into the last command rather than printing it. Store the downloaded original in a password manager/encrypted backup and remove any workspace copy. Never add any of these private values to `EXPO_PUBLIC_` environment variables.

Multiple keys fall back on invalid/revoked credentials, upstream server errors, and connection failures before streaming begins. Groq organization-wide 429 rate limits respect Retry-After instead of cycling keys to evade quotas. An interrupted stream is not retried with another key. Keys and prompts are not logged.

If you previously shipped `EXPO_PUBLIC_GROQ_API_KEYS`, rotate those exposed keys and remove the variable from local/EAS environments. Old installed bundles still contain old values.

## RevenueCat and the stores

For the complete Android/iOS product, credential, offering, key, and purchase flow, follow [mobile/PURCHASES.md](../mobile/PURCHASES.md).

1. Create auto-renewing subscriptions in Google Play Console and App Store Connect. Suggested launch pricing: **₹199/month and ₹1,499/year** in India; **US$3.99/month and US$29.99/year** in the US. Configure regional prices in each store. These are proposed prices, not values the code can publish for you. Both plans include 100 AI responses per calendar month; the annual plan does not grant 1,200 responses at once.
2. Connect both stores to the same RevenueCat project. Create entitlement **`anything_pro`**, attach both subscription products, and put them in the **current/default offering** as its **monthly** and **annual** packages. Use normal monthly/yearly base plans, without installment commitments. The screen reads localized price strings and billing periods from these store products; it never invents a price or savings percentage. Do not configure introductory pricing until the paywall also discloses its exact terms.
3. In RevenueCat's restore behavior choose **Keep with original App User ID** for this account-based app. The SDK uses the signed-in **Firebase UID** as its App User ID, including for restore. A customer must use that account to access its subscription across devices. Do not use emails, a shared hardcoded ID, or anonymous IDs.
4. Add each platform's **public SDK key** to `mobile/.env` (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` and `EXPO_PUBLIC_REVENUECAT_IOS_KEY`). Public SDK keys are designed for clients; the secret v1 API key belongs only in Worker secrets.
5. Publish your actual terms and privacy policy, including subscription and AI provider/data disclosures, then set `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL`. Checkout is disabled until both HTTPS links are set. Configure your store listings' privacy/data safety forms consistently with actual app behavior. Existing saved collections are not sent to AI automatically; the submitted prompt is sent to Cloudflare and Groq, and web research can send search queries to its search provider. RevenueCat processes purchases/account identifiers.

No webhook is required: the server verifies RevenueCat entitlement expiry and billing grace on each request, including renewals, cancellations, refunds, and restores as reflected by RevenueCat. Canceling renewal preserves access through the paid expiry. If RevenueCat verification is unavailable, unused free responses still work; paid access is never granted based on an unverified client claim.

## Deploy and connect

### If the app says AI is unavailable

The mobile app needs `EXPO_PUBLIC_AI_URL=https://YOUR_WORKER.workers.dev/ai` in **mobile/.env**, even if you already added the Groq key in Cloudflare. `.env.example` is a template and is not loaded by Expo. Fully reload the development app after changing the value. For an installed preview/store build, set the same public URL in that profile's EAS environment and rebuild its JavaScript bundle through your normal release process. Never put provider secrets in `EXPO_PUBLIC_` variables.

Development logs use the prefix **[Anything AI]**. Open React Native DevTools from Metro (`j`), or inspect Android logs with `adb logcat -s ReactNativeJS`. Request failures identify the stage: `configuration`, `sign_in`, `firebase_token`, `network`, or `backend_response`. HTTP status and timing are included; tokens, keys, prompts, account IDs, and raw errors are not logged. Generation logs distinguish a stream failure from an initial HTTP failure.

For backend logs, run `npx wrangler tail anything-ai --format pretty` from `worker/`, then reproduce the problem. Backend failure logs identify authentication, usage storage, subscription verification, reservation, provider configuration, or provider streaming. Configuration flags indicate only whether each binding exists, never its value.

A POST to `/ai` without an Authorization header should return **401 JSON** with `sign_in_required`. A Cloudflare HTML error page or HTTP 500 before authentication means the deployed Worker itself is broken. Deploy the tested backend from this directory with `npm run deploy`; adding secrets alone does not upload this code. The deployed Worker must also include `FIREBASE_PROJECT_ID` and `FIREBASE_API_KEY` from `wrangler.jsonc`, alongside the three private secrets listed above.

From `worker/`:

```sh
npm run typecheck
npm test
npm run deploy
```

The first secret command may create the Worker before its code is deployed. Alternatively deploy once, then add all three secrets and deploy again. Copy the printed `https://anything-ai.<your-subdomain>.workers.dev` URL and append **`/ai`**. Set that complete URL in `mobile/.env` as **`EXPO_PUBLIC_AI_URL`** and in the corresponding EAS environment. `mobile/.env.example` lists the public SDK/legal settings too. Restart Expo after environment changes. A rebuilt native app is required for RevenueCat; an OTA update cannot add its native module.

Keep Firestore rules private. Existing rules deny client access to `aiUsage/*`; only the Worker's service account writes these records. Never make the quota or secrets publicly writable/readable. The Worker uses server-side Google OAuth and write preconditions, not client counters. No client-provided subscription flag is trusted. Firebase sign-in and RevenueCat must use the same Firebase UID. Firebase's Admin SDK is not bundled in the Worker or phone.

For a separate staging Worker/project, set `ALLOW_SANDBOX_PURCHASES` to `true` and use store sandbox testers. Production defaults to false and rejects sandbox entitlements. Do not enable staging purchases on your production backend. No webhook is required: each request verifies current RevenueCat entitlement expiry/grace. A RevenueCat outage never grants paid access; unused free responses can still work.

Code checks cover HTTP auth rejection, three successful responses, failure release, concurrent reservation conflicts, Firestore revision retries, monthly resets, sandbox/expired/grace entitlements, and provider fallback/stream parsing. Store purchase/cancel/restore/refund flows and deployed Worker CPU limits still need staging verification; device tests were not run, as requested. Account limits do not guarantee one trial per human: another Google account gets its own trial.

The code is ready for configuration, not deployed. The mobile app has a development-only Test Store key; this does not deploy or configure server secrets or live store purchases. If you already deployed an earlier Firebase function yourself, remove it separately in Firebase Console; this change does not delete cloud resources.

Wrangler development tooling currently reports an upstream Undici advisory with no compatible patched 7.x release available from the registry. The deployed Worker has no npm runtime dependencies and does not bundle this local development dependency. Recheck the tooling before exposing a local development server to untrusted networks.
