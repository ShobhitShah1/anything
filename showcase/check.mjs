import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { safeWebUrl, safeEmail, legalReady } from "./dist/shared.js";
const root = resolve(import.meta.dirname, "dist");
const config = JSON.parse(
  (await readFile(resolve(root, "site-config.json"), "utf8")).replace(
    /^\uFEFF/,
    "",
  ),
);
assert.equal(safeWebUrl("javascript:alert(1)"), null);
assert.equal(safeWebUrl("https://user:password@example.com"), null);
assert.equal(safeWebUrl("http://example.com"), null);
assert.equal(safeWebUrl("https://example.com/app"), "https://example.com/app");
assert.equal(safeEmail("hello@example.com\r\nBcc:other@example.com"), null);
assert.equal(safeEmail("hello@example.com"), "hello@example.com");
assert.equal(
  legalReady({ legal: { publicationReady: true }, operator: {} }),
  false,
);
if (config.legal.publicationReady)
  assert.ok(
    legalReady(config),
    "Release policies require operator identity, country and contact.",
  );
for (const value of Object.values(config.links))
  if (value)
    assert.ok(
      safeWebUrl(value),
      "Public links must be credential-free HTTPS URLs.",
    );
for (const page of ["privacy", "terms", "permissions", "delete-account"])
  assert.ok(config.pages[page]?.sections?.length);
for (const filename of await readdir(root))
  if (filename.endsWith(".html")) {
    const html = await readFile(resolve(root, filename), "utf8");
    assert.match(html, /<title>/);
    assert.match(html, /name="viewport"/);
    for (const [, reference] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:|data:)/.test(reference)) continue;
      const path = resolve(
        dirname(resolve(root, filename)),
        reference.split(/[?#]/)[0],
      );
      assert.ok(
        (await stat(path)).isFile() || (await stat(path)).isDirectory(),
        `${filename}: missing ${reference}`,
      );
    }
  }
console.log(
  "Showcase checks passed: links/assets, policy completeness gates, URL/email safety.",
);
console.log(
  legalReady(config)
    ? "Legal release flag enabled; operator must still review policy accuracy."
    : "Legal pages remain explicitly draft until release details are configured.",
);
