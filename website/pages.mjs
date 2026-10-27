import { cp, mkdir, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
const repository = resolve(import.meta.dirname, "..");
const output = resolve(repository, "dist");
const target = resolve(output, "about");
assert.ok(target.startsWith(output + sep));
assert.ok(
  (await stat(resolve(output, "index.html"))).isFile(),
  "Build the web app before packaging Pages.",
);
await mkdir(target, { recursive: true });
await cp(resolve(import.meta.dirname, "public"), target, { recursive: true });
for (const name of [
  "index.html",
  "privacy.html",
  "terms.html",
  "permissions.html",
  "delete-account.html",
  "site-config.json",
])
  assert.ok((await stat(resolve(target, name))).isFile());
console.log(
  "Pages package ready: web app at /, website and policies at /about/.",
);
