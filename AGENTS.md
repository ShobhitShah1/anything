# Interface design preferences

- Do not use the generic "icon inside a rounded square beside a title and subtitle" treatment. This includes upgrade cards, subscription headers, feature rows, and promotional UI. Icons do not need decorative boxes. Actual interactive controls may retain their necessary backgrounds and touch targets.
- Keep promotional surfaces compact. No oversized upgrade cards, decorative hero illustrations, or large empty areas that displace the screen's useful content.
- Make designs distinctive through typography, composition, spacing, and purposeful detail. Do not substitute repeated icon tiles, nested cards, or marketing slogans for design work.
- Research relevant apps on the web before UI redesigns. Use concrete references appropriate to the screen and adapt them to Anything's existing visual language; do not copy a generic component template.
- Verify visible changes on the running app when available. Check narrow screens, header clipping, text scaling, and both light and dark themes. Report any verification gaps honestly.
- Keep in-app typography fixed: set `allowFontScaling={false}` on text, text inputs, and Markdown renderers; do not resize cards from the system font scale. Extend decorative backgrounds behind system bars while keeping interactive controls comfortably inset.
