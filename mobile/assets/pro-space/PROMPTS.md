# Pro space artwork

Generated locally with the built-in image_gen tool. Style reference: Anything About page lunar art, `website/public/assets/hero-space.webp`.

## Common generation prompt

Original vertical 9:19 mobile background, warm monochrome 1-bit pixel art, near-black #10120f and warm off-white #efeddf, sparse stars, crisp pixel clusters and restrained stippled dithering. Quiet upper left for the screen heading. No UI, text, numbers, logos, frames, borders, bright galaxy bands or photorealism.

## Selected artwork

- `outpost-top.png`: small ringed moon in the upper right; miniature observatory and radio antenna on a thin lunar ridge. The subscription screen uses the original PNG through React Native Image for reliable bundled artwork rendering.

## Final edit prompt

Preserve the vertical dimensions and warm monochrome pixel style. Confine all visible scenery to the top 34% of the canvas. Leave the bottom 66% completely plain solid near-black #10120f, without terrain, stars, objects or texture. Keep the upper left mostly empty for typography. Keep the main object in the upper right around 10–21% height. Relocate the lunar ridge to a shallow strip at 27–33% height and fade smoothly to black below it. No UI, lettering, logos, frames, borders or watermarks.

The screen further clips and shades the top scenery so it cannot appear behind the payment controls. Unused eclipse and voyager alternatives were removed; they were not referenced by the app or exported bundle.
