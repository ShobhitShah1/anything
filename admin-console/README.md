# Anything Admin Console

Standalone Vite operations console in this folder. It is a separate project from the public website and can be hosted at its own domain. It reads saved collection records only after Firebase Authentication returns an ID token with the `admin: true` custom claim. Secret save values are masked by default. It does not expose service-account, RevenueCat, Groq, or Cloudflare credentials.

## GitHub Pages hosting

1. Push this repository to GitHub and set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
2. Add these repository **Variables** under **Settings → Secrets and variables → Actions → Variables**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_CLOUDFLARE_WORKER_URL` (`https://anything-ai.aivideomaker.workers.dev/ai`), `CLOUDFLARE_ACCOUNT_ID`, and `ADMIN_CONSOLE_ORIGIN` (`https://shobhitshah1.github.io`). Firebase web configuration and the Worker URL are public client settings, not server secrets.
3. Add `CLOUDFLARE_API_TOKEN` and `FIREBASE_SERVICE_ACCOUNT_JSON` as repository **Secrets**. Scope the Cloudflare token to Worker edit/deploy for this account. Give the Firebase deploy service account Firebase Rules Admin plus Service Usage Consumer; do not reuse a broad app runtime credential.
4. Add `shobhitshah1.github.io` to Firebase Authentication → Settings → Authorized domains. The console URL will be `https://shobhitshah1.github.io/anything/`; its browser origin is `https://shobhitshah1.github.io`.
5. Set the Pages source to **GitHub Actions**. Push to `main` to deploy the admin console. Changes under `worker/` run the Worker typecheck/tests, then deploy it with the exact origin from `ADMIN_CONSOLE_ORIGIN`. Changes to `firestore.rules` publish through the Firestore rules workflow.
6. The console and Firestore rules both restrict cross-account reads to owner UID `28J4d7cdG9W7az1zZu6x4O5INbp1` with `admin: true`. The rules must be published before collection-group data loads. Only assign that claim to the owner; delegating admins requires a deliberate rules change.

## Assigning the first admin

From a trusted machine with Firebase Admin SDK credentials, run `npm run admin:claim -- <FIREBASE_UID> grant` from this directory. Use `revoke` to remove access. This preserves other custom claims. Never put a service-account JSON file in the repository, GitHub variables, or a `VITE_` value. Sign out and back in after changing a claim.

GitHub Pages is reachable from the public internet, even when its source repository is private. Firebase claims, the owner UID check, and Firestore rules protect the data and admin UI after sign-in, but the sign-in page and static assets themselves are public. Use an access-controlled host (for example, Cloudflare Access) if the page must be unreachable to everyone else.

## Current boundaries

Saved records are grouped by account and are read-only; the app’s tombstone sync and owner-only writes are preserved. The Cloudflare tab shows the signed-in owner’s allowance; Access & billing reads a selected account’s usage and RevenueCat expiry through the owner-only Worker action. Both views are read-only. Pro grants/refunds and secret rotation remain in RevenueCat and Cloudflare; the browser never writes those privileged values.
