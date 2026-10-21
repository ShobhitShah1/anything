# Optional Google sign-in and cloud sync

Anything works without Firebase. With a project configured, users can sign in using Google and separately enable **Sync this collection** from their profile at the top right. No collection data is uploaded just by signing in.

## Connect your project

1. Create a Firebase project and register a **Web app** in **Project settings → Your apps**.
2. Copy `.env.example` to `.env.local` and fill in the values from your web app’s Firebase configuration:

   ```dotenv
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

3. In **Authentication → Sign-in method**, enable **Google** and set its support email.
4. In **Authentication → Settings → Authorized domains**, add the hostname where Anything runs. Add `localhost` for local development and your deployed hostname for production (without a path).
5. Create a **Cloud Firestore Standard edition** database using the default database ID. Choose your region and start in production mode.
6. Install the [Firebase CLI](https://firebase.google.com/docs/cli) if needed, then deploy the repository’s private rules and index exemptions:

   ```bash
   firebase login
   firebase deploy --only firestore --project YOUR_PROJECT_ID
   ```

   `firebase.json` points to `firestore.rules` and `firestore.indexes.json`. The rules allow each signed-in user to access only `users/{their uid}/collection/*`. All other paths are denied. The index exemption keeps saved content out of unnecessary indexes. Do not use public/test-mode rules.

7. Restart `npm run dev`. For production, supply the same `VITE_FIREBASE_*` values in the build environment and rebuild. The GitHub Pages workflow reads them from repository **Settings → Secrets and variables → Actions → Variables** using the names above. Empty values keep the deployment local-only. Vite embeds the web configuration at build time. These are Firebase web app values; a service-account key is not needed.

Official references: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firestore access rules](https://firebase.google.com/docs/firestore/security/rules-conditions).

## What users see

- The welcome screen offers **Continue with Google** and **Continue without an account**. Existing local collections remain accessible.
- The top-right account control shows the signed-in user’s name, photo, and email.
- **Sync this collection** is off until enabled. Its label explains that it merges this browser’s saves, folders, and saved secrets with that Google account. Signing in alone does not enable sync.
- Account status shows connecting, saving, synced, or an error with **Retry sync**. The preference is remembered for the connected account on this browser. Signing out turns it off.
- Turning sync off stops further synchronization; it does not delete the account’s existing cloud data. Signing out keeps a local copy on the device. On a shared device, export anything you need and delete the local collection with sync off before handing the browser to someone else.

## Data and sync behavior

Each save or folder is a separate Firestore record. Local-only entries are added on first sync; existing cloud records with the same ID win unless this browser has a pending local edit. Changes to different records merge independently. Concurrent edits to the same record use the last write accepted by Firestore.

Pending changes and a local sync baseline are kept in browser storage per user. Failed writes remain available for retry after refreshing. Edits made while sync is paused are compared with that baseline on reconnection. An initial server snapshot is required before uploading, so a stale empty cache cannot replace the cloud collection. Once connected, Firebase can queue writes while the network is unavailable; the app does not show them as synced until acknowledged.

Deletions use tombstone records with `data: null` so another device cannot restore old saves. **Delete all saves** removes this browser’s collection and syncs those deletions when cloud sync is enabled; it leaves folder definitions intact. If syncing is paused, the deletions are sent when it resumes. This action does not delete the Google account or Firebase Authentication user.

Large uploaded images may exceed Firestore’s per-document limit. The app checks for records over 900 KB, reports the problem, and keeps the local save and pending changes. Use a hosted image URL for those images. Firestore is not an image upload service in this implementation; Firebase Storage is not used.

Saved secret fields are included only when the user enables collection sync. They are protected by account access rules but are not end-to-end encrypted. Masking a field does not encrypt it.

## Verify after setup

If the profile stays on **Connecting**, Google Authentication may be configured while Firestore is not. In the same Firebase project, open **Build → Firestore Database**, create a **Standard edition `(default)`** database, then publish the contents of `firestore.rules` in the database’s **Rules** tab (or use the deployment command above). A custom database ID is not used by this app. Confirm your `VITE_FIREBASE_PROJECT_ID` matches this project. If the database and rules are already ready, check browser network blocking or connectivity. The app now reports an initial connection timeout after 15 seconds and offers **Retry sync**; local saves remain available.

1. Sign in with Google and confirm the profile details. Leave sync off first; saving should stay local.
2. Enable sync and confirm the collection appears under your own UID in Firestore.
3. In a second browser profile, sign in to the same Google account, enable sync, and check a new save, a pin change, and a deletion in both directions.
4. Disconnect the network, edit a note, then reconnect and check that status changes from saving to synced. Also check a refresh with pending changes.
5. Sign out and verify the local collection remains. Sign in with another account and confirm sync is off; it must not automatically receive the previous account’s collection.
6. Verify rules using the Firebase Emulator Suite before publishing: unauthenticated and different-UID reads/writes must fail; an owner’s valid record should succeed.

Live OAuth and Firestore permissions require your configured project. Until configuration is supplied, the app shows an honest setup message when Google sign-in is requested and continues working locally.
