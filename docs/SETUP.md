# Setup and maintenance

## Local development

Use Node.js 24 or newer.

```bash
npm ci
npm run dev
```

`npm run build` creates the production site in `dist`. `npm run preview` serves that build locally.

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

A domain card appears immediately, and saving never waits for the network. Known image, YouTube, and GitHub links get a cover without a metadata request. CORS-enabled pages are read directly using their HTML metadata, avoiding provider rate limits. A working cover is checked before it is displayed; GitHub Pages mirrors can recover cover URLs that still point at an old custom domain. Other public links use the existing Microlink provider with an eight-second background deadline covering both headers and body. Provider errors are shown rather than reported as a successful preview. JavaScript-only pages may have fewer details; the link still saves normally. Successful previews are cached in the current browser session for 24 hours (up to 100 entries), overlapping requests share the same work, and failures can retry after 30 seconds. Refresh bypasses the local cache. Website screenshot fallbacks are no longer requested.

If you save while metadata is loading, the saved link receives the result in the background. Updates preserve your edited title and notes, and do not recreate deleted items.

References: https://ogp.me/ and https://microlink.io/docs/api/parameters/prerender

Run provider checks with Node 24: `node --test src/utils/fetchPreview.test.mjs`. Browser metadata checks are in `tests/link-preview.browser.mjs`; with Vite running, import that module in the browser and call `runMetadataChecks()`.
