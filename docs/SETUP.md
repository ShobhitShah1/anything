# Setup and maintenance

## Local development

Use Node.js 24 or newer.

```bash
npm ci
npm run dev
```

`npm run build` creates the production site in `dist`. `npm run preview` serves that build locally.

Google sign-in and cloud sync are optional. See [Firebase setup](FIREBASE.md) for web app configuration, authorized domains, private Firestore rules, and verification steps. Keep `.env.local` out of Git and provide the `VITE_FIREBASE_*` values to your production build environment when enabling accounts.

## Deploying to GitHub Pages

One-time repository setup (requires a repository admin or maintainer):

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy to GitHub Pages → Run workflow**, or re-run the failed job.
4. Use the URL reported by the deployment job once it succeeds.

The workflow installs dependencies, checks link previews, builds `dist`, and deploys it. It runs on pushes to `main` or `master`. Vite uses relative asset paths so it also works under a repository subpath.

`Get Pages site failed / Not Found` usually means Pages has not been enabled for that repository. The workflow now checks this before building and links to the setup page. Do not add a personal access token just to bypass this step: `configure-pages` auto-enablement requires additional repository administration access. If Pages is unavailable, check repository visibility, your GitHub plan, and organization policy.

Official setup: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Link preview behavior

A domain card appears immediately, and saving never waits for the network. Direct image links render immediately. General web links race CORS-enabled HTML metadata against Microlink; X posts use FxTwitter, and YouTube/Vimeo metadata uses Noembed. Requests share a five-second deadline covering both headers and body. Images load normally without a blocking cover check, and website screenshot fallbacks are not requested.

Successful previews are cached in the current browser session for 24 hours (up to 100 entries). Overlapping requests share the same work, and failures can retry after 15 seconds. Refresh preview in the item details bypasses the local cache. Public services may rate-limit requests, and some sites provide incomplete metadata; the original link still saves normally.

If you save while metadata is loading, the saved link receives the result in the background. Updates preserve your edited title and notes, and do not recreate deleted items.

References: https://ogp.me/ and https://microlink.io/docs/api/parameters/prerender

Run provider checks with Node 24: `node --test src/utils/fetchPreview.test.mjs src/utils/masonry.test.mjs src/utils/storage.test.mjs public/sw.test.mjs`. Browser metadata checks are in `tests/link-preview.browser.mjs`; with Vite running, import that module in the browser and call `runMetadataChecks()`.
