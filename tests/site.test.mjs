import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { services, site } from "../site.config.mjs";

const root = process.cwd();
const pages = [
  "index.html",
  "services.html",
  "haircuts.html",
  "keratin.html",
  "nanoplasty.html",
  "gallery.html",
  "about.html",
  "contact.html",
  "book.html",
  "404.html",
];

test("builds a complete static multi-page website", async () => {
  for (const page of pages) {
    const sourcePath = path.join(root, page);
    const distPath = path.join(root, "dist", page);
    assert.equal(existsSync(sourcePath), true, page + " should exist in the project root");
    assert.equal(existsSync(distPath), true, page + " should exist in dist");
    const html = await readFile(sourcePath, "utf8");
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<main id="main-content">/);
    assert.match(html, /css\/style\.css/);
    assert.match(html, /css\/style\.css\?v=[a-f0-9]{10}/);
    assert.match(html, /js\/main\.js/);
    assert.doesNotMatch(html, /localhost|127\.0\.0\.1/);
    assert.doesNotMatch(html, /local website preview|from this local website/i);
    for (const link of html.matchAll(/<a[^>]*target="_blank"[^>]*>/g)) {
      assert.match(link[0], /rel="noopener noreferrer"/);
    }
  }
});

test("keeps confirmed business details and pricing correct", async () => {
  assert.equal(site.email, "Rachsu99@gmail.com");
  assert.match(site.instagram, /instagram\.com\/hairbyrachel\.nz/);
  assert.deepEqual(
    services.map((service) => service.prices),
    [
      [["Ladies Haircut", "$85"], ["Shampoo, Treatment & Haircut", "$95"]],
      [["Short Hair", "from $180"], ["Medium Hair", "from $230"], ["Long Hair", "from $280"], ["Extra Long / Thick Hair", "from $330"]],
      [["Short Hair", "from $280"], ["Medium Hair", "from $340"], ["Long Hair", "from $400"], ["Extra Long / Thick Hair", "from $550"]],
    ]
  );
  for (const page of pages) {
    const html = await readFile(path.join(root, page), "utf8");
    assert.match(html, /Rachsu99@gmail\.com/);
    assert.match(html, /instagram\.com\/hairbyrachel\.nz/);
  }
});

test("has no broken local page or asset references", async () => {
  for (const page of pages) {
    const html = await readFile(path.join(root, page), "utf8");
    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(
      (match) => match[1].split("#")[0].split("?")[0]
    );

    for (const reference of references) {
      if (!reference || /^(?:https?:|mailto:)/.test(reference)) continue;
      assert.equal(
        existsSync(path.join(root, reference)),
        true,
        page + " references missing local file " + reference
      );
    }
  }
});

test("keeps the enquiry flow honest and accessible", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const contact = await readFile(path.join(root, "contact.html"), "utf8");
  const gallery = await readFile(path.join(root, "gallery.html"), "utf8");
  assert.match(home, /assets\/images\/brand\/rachel-portrait\.webp/);
  assert.match(home, /rachel-portrait-560\.webp 560w/);
  assert.doesNotMatch(home, /hero-photo--detail/);
  assert.doesNotMatch(contact, /contact-hero__flower|contact-flower\.webp/);
  assert.match(contact, /Nothing is submitted to a server/);
  assert.match(contact, /name="name"[^>]*required/);
  assert.match(contact, /name="email" type="email"/);
  assert.match(contact, /Prepare email enquiry/);
  assert.match(gallery, /<dialog class="lightbox"/);
  assert.match(gallery, /data-lightbox-close/);
});

test("emits production domain metadata and Cloudflare deployment files", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const keratin = await readFile(path.join(root, "keratin.html"), "utf8");
  const notFound = await readFile(path.join(root, "404.html"), "utf8");
  const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");

  assert.match(home, /<link rel="canonical" href="https:\/\/esenciahair\.co\.nz\/">/);
  assert.match(keratin, /<link rel="canonical" href="https:\/\/esenciahair\.co\.nz\/keratin">/);
  assert.match(keratin, /og:image" content="https:\/\/esenciahair\.co\.nz\/assets\/images\/editorial\/silky-hair\.webp"/);
  assert.match(notFound, /noindex,follow/);
  assert.match(sitemap, /<loc>https:\/\/esenciahair\.co\.nz\/services<\/loc>/);
  assert.doesNotMatch(sitemap, /\.html<\/loc>/);
  assert.equal(existsSync(path.join(root, "dist", "_headers")), true);
  assert.equal(existsSync(path.join(root, "dist", "robots.txt")), true);
});
