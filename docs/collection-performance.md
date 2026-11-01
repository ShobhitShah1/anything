# Collection rendering

The web collection uses `@tanstack/react-virtual` for both the masonry grid and the list. Item IDs key measurements; masonry columns use measured lane assignment. Only the viewport and four overscan rows mount, plus an open item's source and keyboard focus. Resizing invalidates height measurements.

Motion animates deliberate collection reordering. Scrolling and image measurement do not trigger reflow animations. Image dimensions stay in card state rather than writing the collection back to storage.

Dialogs use viewport rectangles and the Web Animations API for the card-to-panel transition. This works across the native dialog top layer; the source remains mounted until exit completes. Reduced motion uses a short fade. Native dialogs retain focus trapping and Escape handling.

## Local regression fixture

Run `npm run dev -- --host 127.0.0.1 --port 5175` and open `/tests/collection-performance.html` on that server in a fresh browser origin. Do not sign in on the fixture origin. It uses 3,000 synthetic saves; `?count=10000` increases the dataset. It refuses to replace a collection containing non-fixture IDs.

Click **Run collection checks** in Grid and List. The checks cover bounded DOM, overlap, horizontal overflow, the last item, returning to the top, and card/reader transitions at the top and after deep scrolling. The fixture includes a React Profiler. Browser frame timings depend on the host and whether background tabs are throttled; they are diagnostic rather than a device performance guarantee.

Also check narrow widths, light/dark themes, image opening/closing, rapid dismissal, keyboard navigation, search, sort, pinning and deletion. Fixture files are excluded from the production Vite entry point.

References: [TanStack Virtual options](https://tanstack.com/virtual/latest/docs/api/virtualizer), [Motion layout animations](https://motion.dev/docs/react-layout-animations), [Virtuoso Masonry](https://virtuoso.dev/masonry/).

## Verification

The 3,000-item browser fixture passed the automated grid/list checks at desktop width and the grid checks at narrow width. At 1280 × 900, the grid mounted 21–39 cards (React render P95 8.6 ms); the list mounted 16–23 rows (render P95 6.2 ms). These are individual development-browser runs, not release benchmarks. Narrow light/dark layouts, search, sorting, pin/unpin and nested image dismissal were checked interactively. The production build and 26 utility tests passed. Lint reports the TanStack/React Compiler compatibility warning; this project does not enable React Compiler.

Foreground Chrome verification was unavailable because computer-control approval timed out. OS text scaling and a live reduced-motion preference were not exercised. The reduced-motion branch was reviewed in code.
