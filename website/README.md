# Anything website

`website/` is the separate, dependency-free product website and policy source. The collection web app remains in the repository's `src/` and `public/` folders; the Android app is in `mobile/`.

## Edit one JSON file

Open `public/site-config.json`. It contains:

- `links`: the real HTTPS web-app, Google Play and App Store URLs. Empty links stay hidden; no fake download buttons.
- `operator`: legal owner, country, public postal address and support/privacy email. This is public information only. Never put API keys, service-account JSON or private credentials here.
- `legal`: effective date, minimum age, retention, transfers, legal bases, jurisdiction and whether account-deletion requests are operational.
- `pages`: all privacy, permissions, terms and deletion copy. You can edit the text without changing the page renderer.

Keep `legal.publicationReady` false until identity/contact details and the actual processing, retention and legal obligations have been reviewed for the markets served. Blank operator fields cannot silently produce a final policy. An email link is not an automated deletion service. Set `accountDeletionRequestsEnabled` true only after a real inbox and an identity-checked deletion process are operational. The current app also needs a tested in-app account-deletion request path before a store release requiring it.

Store pricing is deliberately read from the purchase flow, not invented on the site. The terms describe the current three free responses and 100 Pro responses per UTC calendar month. Update the copy if the product changes.

## Check and preview

From this folder: `npm run check`, then `npm run preview`. The local URL is `http://127.0.0.1:5182`. No install or build is needed. `public/` is the complete static site, intentionally tracked here.

The landscape artwork in `public/assets/hero-landscape.webp` is original, generated for Anything in charcoal and ivory. The foreground images are unaltered app captures. The landscape has a small CSS scroll-driven drift when supported; sections reveal once through IntersectionObserver. Reduced-motion preferences remove the motion. Content remains readable if animation APIs are unsupported.

## Legal pages

- `privacy.html`
- `permissions.html`
- `terms.html`
- `delete-account.html`

These are release-review drafts, not a claim of compliance or a completed account-deletion backend. Before using them as store privacy/terms URLs, publish them on a public domain, complete the settings, verify provider handling and test the deletion process. A private Sites preview cannot serve as a publicly accessible store policy URL.

## Deployment

GitHub Pages uses the repository's existing `.github/workflows/deploy.yml`. It builds the web app, checks this site, and runs `node website/pages.mjs` to include the showcase and policies at `/anything/about/`. The web app remains at `/anything/`. Only `website/public/` is copied into the Pages artifact; Firebase configuration files, `.env`, signing credentials and Worker secrets are excluded. A push to `main` or a manual workflow run deploys the combined artifact.

To publish a website edit, commit the changed files under `website/` and push to `main`. The **Deploy to GitHub Pages** action publishes the app and website together. Check the action's deployment result before treating an update as live. No separate website build, hosting account or access token is needed. `store-listing/` stays local, is ignored by Git, and is never copied into the Pages artifact.

Design references: [Are.na](https://www.are.na/about) for collection-first presentation and [Kinopio](https://kinopio.club/) for making saved ideas tangible. Product images are real captures of the Android and web apps with the same fictional sample collection. There are no invented endorsements, ratings or download links.

Visual direction for the illustrated redesign: [Surfsky on Behance](https://www.behance.net/gallery/256361907/Surfsky-Website-Branding-for-Antidetect-Browser/modules/1495010417), adapted through original neutral artwork and Anything?s real interface. No reference images or third-party branding are included in the shipped assets.
