import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { formatPrice, priceDefinitions } from "../price.config.mjs";
import { services, site } from "../site.config.mjs";

const root = process.cwd();
const pages = [
  "index.html",
  "services.html",
  "haircuts.html",
  "keratin.html",
  "nanoplasty.html",
  "hair-extensions.html",
  "extension-removal.html",
  "styling.html",
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
  assert.equal(site.email, "Hello@esenciahair.co.nz");
  assert.equal(site.bookingsEmail, "Bookings@esenciahair.co.nz");
  assert.match(site.instagram, /instagram\.com\/hairbyrachel\.nz/);
  assert.deepEqual(
    services.map((service) => service.prices),
    [
      [["Ladies Haircut", "$85"], ["Shampoo, Treatment & Haircut", "$95"]],
      [["Short Hair", "from $180"], ["Medium Hair", "from $230"], ["Long Hair", "from $280"], ["Extra Long / Thick Hair", "from $330"]],
      [["Short Hair", "from $280"], ["Medium Hair", "from $340"], ["Long Hair", "from $400"], ["Extra Long / Thick Hair", "from $550"]],
      [["Tape Extensions", "Price on Consultation"], ["K-Tip Extensions", "Price on Consultation"]],
      [["Tape Extension Removal", "from $60"], ["K-Tip Extension Removal", "from $100"]],
      [["Shampoo & Blow-Dry", "$55"], ["Dry Style – Curls & Waves", "$45"]],
    ]
  );
  for (const page of pages) {
    const html = await readFile(path.join(root, page), "utf8");
    assert.match(html, /Hello@esenciahair\.co\.nz/);
    if (page !== "404.html") assert.match(html, /Bookings@esenciahair\.co\.nz/);
    assert.doesNotMatch(html, /Rachsu99@gmail\.com/i);
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
  assert.match(home, /assets\/images\/studio\/rachel-hero\.webp/);
  assert.doesNotMatch(home, /rachel-sticker/);
  assert.doesNotMatch(home, /hero-photo--detail/);
  assert.doesNotMatch(contact, /contact-hero__flower|contact-flower\.webp/);
  assert.match(contact, /Nothing is submitted to a server/);
  assert.match(contact, /name="name"[^>]*required/);
  assert.match(contact, /name="email" type="email"/);
  assert.match(contact, /Prepare email enquiry/);
  assert.match(gallery, /<dialog class="lightbox"/);
  assert.match(gallery, /data-lightbox-close/);
  assert.equal(existsSync(path.join(root, "nanoplasty.html")), true);
  assert.equal(services.find((service) => service.slug === "keratin")?.visible, true);
  assert.equal(services.find((service) => service.slug === "nanoplasty")?.visible, true);
  assert.match(home, /data-service="keratin"/);
  assert.doesNotMatch(home, /data-service="keratin" hidden/);
  assert.match(home, /data-service="nanoplasty"/);
  assert.doesNotMatch(home, /data-service="nanoplasty" hidden/);
  assert.match(home, /<section class="location-section"/);
  assert.match(home, /Find Us in Greenlane/);
  assert.match(home, /Greenlane, Auckland/);
  assert.match(home, /title="Map showing the Greenlane area of Auckland"/);
  assert.match(home, /loading="lazy"/);
  assert.doesNotMatch(home, /1[9]3\s+Green\s+Lane\s+West|1[0]51/i);
});

test("publishes Keratin aftercare and extension information", async () => {
  const keratin = await readFile(path.join(root, "keratin.html"), "utf8");
  const nanoplasty = await readFile(path.join(root, "nanoplasty.html"), "utf8");
  const extensions = await readFile(path.join(root, "hair-extensions.html"), "utf8");
  const removal = await readFile(path.join(root, "extension-removal.html"), "utf8");
  const styling = await readFile(path.join(root, "styling.html"), "utf8");

  assert.match(keratin, /avoid washing your hair for 48 hours/i);
  assert.match(keratin, /complimentary shampoo and conditioner/i);
  assert.match(keratin, /StraightOut/i);
  assert.match(keratin, /formaldehyde-free/i);
  assert.match(keratin, /Results can last up to 3 months/i);
  assert.match(keratin, /Ready for smoother, more manageable hair/i);
  assert.match(nanoplasty, /What Is Nanoplasty\?/);
  assert.match(nanoplasty, /Why You’ll Love Nanoplasty/);
  assert.match(nanoplasty, /Ultra-Sleek Long-Lasting Results/);
  assert.match(nanoplasty, /100% Frizz Freedom/);
  assert.match(nanoplasty, /Mirror-Like Shine/);
  assert.match(nanoplasty, /Deep Fibre Restoration/);
  assert.match(nanoplasty, /Clean, Vegan Formula/);
  assert.match(nanoplasty, /Style Your Way/);
  assert.match(nanoplasty, /Vivo stylist will choose the correct Floractive formula/);
  assert.match(nanoplasty, /assets\/images\/studio\/nanoplasty-floractive\.jpeg/);
  assert.match(nanoplasty, /Frequently asked questions/);
  assert.match(nanoplasty, /How long does Nanoplasty last\?/);
  assert.match(nanoplasty, /Aftercare & Maintenance/);
  assert.match(nanoplasty, /Should I use a sulphate-free shampoo\?/);
  assert.doesNotMatch(nanoplasty, /advanced smoothing option for clients/i);
  assert.match(extensions, /Tape Extensions/);
  assert.match(extensions, /K-Tip Extensions/);
  assert.match(extensions, /Price on Consultation/);
  assert.match(extensions, /assets\/images\/studio\/tape-in-extensions-1\.webp/);
  assert.match(removal, /Tape Extension Removal/);
  assert.match(removal, /K-Tip Extension Removal/);
  assert.match(styling, /data-styling-options="detail"/);
  assert.match(styling, /<span>Extra Long \/ Thick Hair<\/span><strong>\+\$10<\/strong>/);
});

test("keeps private admin routes and credentials out of public markup", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const robots = await readFile(path.join(root, "robots.txt"), "utf8");
  const wrangler = await readFile(path.join(root, "wrangler.jsonc"), "utf8");
  assert.doesNotMatch(home, /\/admin|ADMIN_PASSWORD|SESSION_SECRET/);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\/admin\//);
  assert.match(wrangler, /"directory": "\.\/dist"/);
  assert.doesNotMatch(wrangler, /ADMIN_PASSWORD|SESSION_SECRET|pbkdf2-sha256\$|Rachsu99@gmail\.com/);
  assert.match(wrangler, /"migrations_dir": "\.\/migrations"/);
  assert.match(wrangler, /"\/api\/prices"/);
  assert.equal(existsSync(path.join(root, "dist", "assets", "images", "brand", "rachel-sticker.png")), false);
});

test("maps every current service price to a stable dynamic key with a static fallback", async () => {
  const publicHtml = (await Promise.all(pages.map((page) => readFile(path.join(root, page), "utf8")))).join("\n");
  for (const definition of priceDefinitions) {
    assert.match(publicHtml, new RegExp(`data-price-key="${definition.key}"`), `${definition.key} should be consumed publicly`);
    assert.equal(formatPrice(definition.amountCents, definition.displayType).length > 0, true);
  }
  assert.match(publicHtml, /data-service-schema="keratin"/);
  assert.match(publicHtml, /data-service-schema="nanoplasty"/);
});

test("emits production domain metadata and Cloudflare deployment files", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const keratin = await readFile(path.join(root, "keratin.html"), "utf8");
  const notFound = await readFile(path.join(root, "404.html"), "utf8");
  const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");

  assert.match(home, /<link rel="canonical" href="https:\/\/esenciahair\.co\.nz\/">/);
  assert.match(keratin, /<link rel="canonical" href="https:\/\/esenciahair\.co\.nz\/keratin">/);
  assert.match(keratin, /og:image" content="https:\/\/esenciahair\.co\.nz\/assets\/images\/studio\/glossy-brunette\.webp"/);
  assert.match(notFound, /noindex,follow/);
  assert.match(sitemap, /<loc>https:\/\/esenciahair\.co\.nz\/services<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/esenciahair\.co\.nz\/keratin<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/esenciahair\.co\.nz\/nanoplasty<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/esenciahair\.co\.nz\/hair-extensions<\/loc>/);
  assert.doesNotMatch(sitemap, /\.html<\/loc>/);
  assert.equal(existsSync(path.join(root, "dist", "_headers")), true);
  assert.equal(existsSync(path.join(root, "dist", "robots.txt")), true);
});

test("routes public general and booking emails deliberately", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const contact = await readFile(path.join(root, "contact.html"), "utf8");
  const book = await readFile(path.join(root, "book.html"), "utf8");
  const keratin = await readFile(path.join(root, "keratin.html"), "utf8");

  assert.match(contact, /mailto:Hello@esenciahair\.co\.nz" data-contact-email="general"/);
  assert.match(contact, /mailto:Bookings@esenciahair\.co\.nz" data-contact-email="bookings"/);
  assert.match(book, /mailto:Bookings@esenciahair\.co\.nz" data-contact-email="bookings"/);
  assert.match(home, /mailto:Hello@esenciahair\.co\.nz" data-contact-email="general"/);
  assert.match(home, /mailto:Bookings@esenciahair\.co\.nz/);
  assert.match(keratin, /"@type":"Service"/);
  assert.match(keratin, /"email":"Hello@esenciahair\.co\.nz"/);
  assert.doesNotMatch(home + contact + book + keratin, /Rachsu99@gmail\.com/i);
});
