import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { safeWebUrl, safeEmail, legalReady } from "./public/shared.js";
import { policyNames, renderLegalPage } from './render-legal.mjs';
const root = resolve(import.meta.dirname, "public");
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
for (const [key, title] of Object.entries(policyNames)) {
  const html = await readFile(resolve(root, `${key}.html`), 'utf8');
  assert.equal(html, renderLegalPage(config, key), `Run node website/render-legal.mjs after editing ${key} policy settings.`);
  assert.ok(html.includes(`<h1>${title.replaceAll('&', '&amp;')}</h1>`));
  assert.ok(!html.includes('Enable JavaScript to read'));
}
const untrusted = structuredClone(config);
untrusted.pages.privacy.sections[0].paragraphs = ['<script>alert("unsafe")</script>'];
untrusted.pages.privacy.sections[0].link = { href: 'javascript:alert(1)', label: 'Unsafe' };
const escaped = renderLegalPage(untrusted, 'privacy');
assert.ok(escaped.includes('&lt;script&gt;'));
assert.ok(!escaped.includes('<script>') && !escaped.includes('javascript:'));
const deletion = structuredClone(config);
deletion.operator.privacyEmail = 'privacy@example.com';
deletion.legal.accountDeletionRequestsEnabled = false;
assert.ok(!renderLegalPage(deletion, 'delete-account').includes('?subject='));
deletion.legal.accountDeletionRequestsEnabled = true;
assert.ok(renderLegalPage(deletion, 'delete-account').includes('mailto:privacy@example.com?subject='));
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
  "Website checks passed: links/assets, policy completeness gates, URL/email safety.",
);
console.log(
  legalReady(config)
    ? "Legal release flag enabled; operator must still review policy accuracy."
    : "Legal pages remain explicitly draft until release details are configured.",
);
