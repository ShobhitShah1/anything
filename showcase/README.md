# Anything showcase

This is a separate, dependency-free marketing site. It does not replace or change the collection web app's routes, storage or sign-in.

## Edit one JSON file

Open `dist/site-config.json`. It contains:

- `links`: the real HTTPS web-app, Google Play and App Store URLs. Empty links stay hidden; no fake download buttons.
- `operator`: legal owner, country, public postal address and support/privacy email. This is public information only. Never put API keys, service-account JSON or private credentials here.
- `legal`: effective date, minimum age, retention, transfers, legal bases, jurisdiction and whether account-deletion requests are operational.
- `pages`: all privacy, permissions, terms and deletion copy. You can edit the text without changing the page renderer.

Keep `legal.publicationReady` false until identity/contact details and the actual processing, retention and legal obligations have been reviewed for the markets served. Blank operator fields cannot silently produce a final policy. An email link is not an automated deletion service. Set `accountDeletionRequestsEnabled` true only after a real inbox and an identity-checked deletion process are operational. The current app also needs a tested in-app account-deletion request path before a store release requiring it.

Store pricing is deliberately read from the purchase flow, not invented on the site. The terms describe the current three free responses and 100 Pro responses per UTC calendar month. Update the copy if the product changes.

## Check and preview

From this folder: `npm run check`, then `npm run preview`. The local URL is `http://127.0.0.1:5182`. No install or build is needed. `dist/` is the complete static site, intentionally tracked here.

The product image has a small CSS scroll-driven reveal when supported, and sections reveal once through IntersectionObserver. Reduced-motion preferences remove position changes. Content remains readable if animation APIs are unsupported.

## Legal pages

- `privacy.html`
- `permissions.html`
- `terms.html`
- `delete-account.html`

These are release-review drafts, not a claim of compliance or a completed account-deletion backend. Before using them as store privacy/terms URLs, publish them on a public domain, complete the settings, verify provider handling and test the deletion process. A private Sites preview cannot serve as a publicly accessible store policy URL.

## Deployment

GitHub Pages uses the repository's existing `.github/workflows/deploy.yml`. It builds the web app, checks this site, and runs `node showcase/pages.mjs` to include the showcase and policies at `/anything/about/`. The web app remains at `/anything/`. Only `showcase/dist/` is copied into the Pages artifact; Firebase configuration files, `.env`, signing credentials and Worker secrets are excluded. A push to `main` or a manual workflow run deploys the combined artifact.

Design references: [Are.na](https://www.are.na/about) for collection-first presentation and [Kinopio](https://kinopio.club/) for making saved ideas tangible. Product images are real captures of the Android and web apps with the same fictional sample collection. There are no invented endorsements, ratings or download links.
