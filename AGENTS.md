# Interface design preferences

- Do not use the generic "icon inside a rounded square beside a title and subtitle" treatment. This includes upgrade cards, subscription headers, feature rows, and promotional UI. Icons do not need decorative boxes. Actual interactive controls may retain their necessary backgrounds and touch targets.
- Keep promotional surfaces compact. No oversized upgrade cards, decorative hero illustrations, or large empty areas that displace the screen's useful content.
- Make designs distinctive through typography, composition, spacing, and purposeful detail. Do not substitute repeated icon tiles, nested cards, or marketing slogans for design work.
- Research relevant apps on the web before UI redesigns. Use concrete references appropriate to the screen and adapt them to Anything's existing visual language; do not copy a generic component template.
- Verify visible changes on the running app when available. Check narrow screens, header clipping, text scaling, and both light and dark themes. Report any verification gaps honestly.
- Keep in-app typography fixed: set `allowFontScaling={false}` on text, text inputs, and Markdown renderers; do not resize cards from the system font scale. Extend decorative backgrounds behind system bars while keeping interactive controls comfortably inset.

- Avoid generic welcome screens built from a tiny centered logo, headline and button stack, or a stock split layout with an isolated illustration beside copy. Compose the empty state for Anything rather than using a reusable marketing template.
- For the empty collection welcome, use original, screen-specific full-bleed monochrome pixel-art space scenery in the same visual language as the promotional website. Do not reuse the website's existing hero/background image. Keep the scenery sparse: a small moon, a low horizon and a few stars; avoid bright galaxy bands, dense starfields or giant planets. Keep Google sign-in prominent and text comfortably readable. Do not use standalone arch illustrations, decorative icon boxes, or framed artwork panels for this view.
- Prepare UI changes locally for review. Do not push or deploy them to the live site without the user's explicit approval.
