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

The original monochrome pixel-art observatory is `public/assets/pixel-space.webp` (198 KB), generated with the built-in imagegen tool. Prompt: a charcoal-and-ivory pixel-art space scene, ringed planet, lunar observatory, square stars and open dark space for the headline; no text, logos or neon. CSS adds a subtle scroll-driven drift where supported, three fading stars and once-only section reveals. Reduced-motion preferences remove movement. No animation library or scroll event loop is required.

## Legal pages

- `privacy.html`
- `permissions.html`
- `terms.html`
- `delete-account.html`

These are release-review drafts, not a claim of compliance or a completed account-deletion backend. Before using them as store privacy/terms URLs, publish them on a public domain, complete the settings, verify provider handling and test the deletion process. A private Sites preview cannot serve as a publicly accessible store policy URL.

## Deployment

GitHub Pages uses the repository's existing `.github/workflows/deploy.yml`. It builds the web app, checks this site, and runs `node website/pages.mjs` to include the showcase and policies at `/anything/about/`. The web app remains at `/anything/`. Only `website/public/` is copied into the Pages artifact; Firebase configuration files, `.env`, signing credentials and Worker secrets are excluded. A push to `main` or a manual workflow run deploys the combined artifact.

To publish a website edit, commit the changed files under `website/` and push to `main`. The **Deploy to GitHub Pages** action publishes the app and website together. Check the action's deployment result before treating an update as live. No separate website build, hosting account or access token is needed. `store-listing/` stays local, is ignored by Git, and is never copied into the Pages artifact.

Design references: [Are.na](https://www.are.na/about) for collection-first presentation and [Kinopio](https://kinopio.club/) for making saved ideas tangible. The existing published app images are retained unchanged at the owner?s request. Replace `public/assets/web-dark.png`, `mobile-home.png` and `mobile-folders.png` with approved local-data captures later. No new demo records or screenshot replacements are shipped in this redesign.

Visual direction for the illustrated redesign: [Surfsky on Behance](https://www.behance.net/gallery/256361907/Surfsky-Website-Branding-for-Antidetect-Browser/modules/1495010417), adapted through original neutral artwork and Anything?s real interface. No reference images or third-party branding are included in the shipped assets.

Space art reference: [NASA?s retrofuturistic space art](https://www.nasa.gov/image-article/retrofuturistic-nasa-space-art/) for the observatory atmosphere. The shipped pixel illustration is original; no NASA imagery or branding is used.
