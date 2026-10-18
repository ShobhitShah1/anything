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
| `⌘K` or `Ctrl+K` | Open Quick Capture modal anywhere |
| `Esc` | Close modal or full-screen image lightbox |
| `←` / `→` | Navigate previous/next item in Focus Mode |
| `Enter` / `,` | Add tag in capture modal or add checklist task |

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
