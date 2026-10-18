# Anything. — Minimalist Digital Vault

> **"Anything is memory built for humans."**  
> A serene, tactile, whisper-quiet white canvas to save posts from **𝕏 (Twitter)**, **Reddit**, and **Instagram**, store credentials & passwords, sketch ideas with interactive checklists, curate visual inspiration, and preserve code snippets.

Inspired by the design aesthetics and craft of:
- [alexchen.sh](https://alexchen.sh/) — Monospace editorial labels (`// memory stream`, `// pinned`), elastic hover arrows `↗`, and hairline borders.
- [tryengage.si](https://www.tryengage.si/) — Pure white editorial canvas, serene line-heights, and thoughtful phrasing.
- [withanimation.app](https://www.withanimation.app/) — Fluid spring physics, tactile micro-interactions, responsive card layouts, and dynamic island capture dock.

---

## ✨ Features

- **Save Anything**:
  - **𝕏 / Twitter Posts**: Author name, handle, avatar, verified badge, full tweet body, attached media, like/repost metrics, original link.
  - **Reddit Posts**: Subreddit tag (`r/design`, `r/webdev`), author, upvotes, comment counter, title, body.
  - **Instagram Posts**: Creator handle, photo/visual frame, caption, direct link.
  - **Passwords & Secrets**: Masked values (`••••••••`), tactile hold/click to reveal, 1-click clipboard copy, security strength meter, categories (Wi-Fi, API Key, Password, Token).
  - **Notes & Ideas**: Monospace/Serif/Sans typography mood switcher, interactive checklists with animated strike-throughs and completion celebration.
  - **Images & Moodboards**: File upload or direct image URLs, full-screen spring lightbox viewer with zoom & download.
  - **Web Bookmarks / Links**: Domain badge, favicon, title, preview image, description.
  - **Code Snippets**: Syntax-styled dark container with language badge and 1-click copy.
- **Pinning System**:
  - Pin any item to the dedicated top **Pinned Shelf**.
  - Smooth spring layout reordering when items are pinned/unpinned.
- **Smart URL Auto-Detection**:
  - Simply paste an 𝕏, Reddit, Instagram, or image URL into the capture bar — it automatically selects the correct content tab and extracts the handle/subreddit.
- **Multiple View Modes**:
  - **Masonry Grid**: Visual gallery layout with dedicated pinned shelf.
  - **Compact List**: Alex Chen / Linear style clean row list with monospace metadata and hover reveals.
  - **Focus Canvas**: Distraction-free slide view with keyboard arrow navigation (`←` / `→`) and progress indicator.
- **Micro-Interactions & Audio**:
  - Built-in Web Audio API synthesizer for satisfying physical tactile clicks, pops, and chimes (toggleable in header).
  - Confetti bursts on completing task lists or saving items.
- **Local Persistence & Portability**:
  - Instant `localStorage` auto-sync.
  - 1-click **Export to JSON** backup & **Import from JSON**.
  - One-click restore to sample library if needed.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` or `Ctrl+K` | Open the capture screen anywhere |
| `Esc` | Close modal or full-screen image lightbox |
| `←` / `→` | Navigate previous/next item in Focus Mode |
| `Enter` / `,` | Add tag in capture screen or add checklist task |

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```


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
