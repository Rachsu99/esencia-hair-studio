import assert from "node:assert/strict";
import test from "node:test";
import { formatPrice } from "../price.config.mjs";
import { verifyAccessJwt } from "../worker/access-auth.ts";
import { createWorker, validatePriceUpdate, validateStylingBatch } from "../worker/index.ts";

const base64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

async function accessFixture(teamDomain = "https://test.cloudflareaccess.com") {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const payload = base64url({ aud: ["test-audience"], email: "owner@example.test", exp: now + 300, iat: now, iss: `${teamDomain}/`, sub: "test-user" });
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(unsigned));
  return { token: `${unsigned}.${Buffer.from(signature).toString("base64url")}`, jwk };
}

test("formats every supported price style centrally", () => {
  assert.equal(formatPrice(8500, "fixed"), "$85");
  assert.equal(formatPrice(18000, "from"), "from $180");
  assert.equal(formatPrice(1000, "surcharge"), "+$10");
  assert.equal(formatPrice(null, "consultation"), "Price on Consultation");
});

test("strictly validates price updates", () => {
  assert.deepEqual(validatePriceUpdate({ key: "keratin-short", amountCents: 19000, version: 1 }), { key: "keratin-short", amountCents: 19000, version: 1 });
  for (const amountCents of [-1, "abc", NaN, Infinity, "<script>", 5_000_001]) {
    assert.throws(() => validatePriceUpdate({ key: "keratin-short", amountCents, version: 1 }));
  }
  assert.throws(() => validatePriceUpdate({ key: "unknown-price", amountCents: 1000, version: 1 }));
  assert.throws(() => validatePriceUpdate({ key: "extensions-tape", amountCents: 1000, version: 1 }));
  assert.throws(() => validatePriceUpdate({ key: "keratin-short", amountCents: 19000, version: 1, sql: "DROP TABLE service_prices" }));
});

test("strictly validates dynamic Styling options", () => {
  assert.deepEqual(validateStylingBatch({ items: [{ key: null, label: " Event Styling ", amountCents: 7500, version: null }], removed: [] }), {
    items: [{ key: null, label: "Event Styling", amountCents: 7500, version: null }],
    removed: [],
  });
  for (const label of ["", "x", "a".repeat(81), "bad\u0000name"]) {
    assert.throws(() => validateStylingBatch({ items: [{ key: null, label, amountCents: 7500, version: null }], removed: [] }));
  }
  for (const amountCents of [-1, "75", NaN, Infinity, 5_000_001]) {
    assert.throws(() => validateStylingBatch({ items: [{ key: null, label: "Event Styling", amountCents, version: null }], removed: [] }));
  }
  assert.throws(() => validateStylingBatch({ items: [], removed: [] }));
  assert.throws(() => validateStylingBatch({ items: [{ key: "styling-blow-dry", label: "Blow-Dry", amountCents: 5500, version: 1 }], removed: [{ key: "styling-blow-dry", version: 1 }] }));
});

test("verifies a correctly signed Cloudflare Access JWT", async () => {
  const { token, jwk } = await accessFixture();
  const identity = await verifyAccessJwt(token, { teamDomain: "https://test.cloudflareaccess.com", audience: "test-audience" }, async () => new Response(JSON.stringify({ keys: [jwk] })));
  assert.deepEqual(identity, { email: "owner@example.test", subject: "test-user" });
  const parts = token.split(".");
  const tamperedSignature = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  await assert.rejects(() => verifyAccessJwt(`${parts[0]}.${parts[1]}.${tamperedSignature}`, { teamDomain: "https://test.cloudflareaccess.com", audience: "test-audience" }, async () => new Response(JSON.stringify({ keys: [jwk] }))));
});

test("rejects unauthenticated and cross-origin administrative writes", async () => {
  const worker = createWorker();
  const teamDomain = "https://test-two.cloudflareaccess.com";
  const unavailableDatabase = { prepare() { throw new Error("Database should not be reached"); } };
  const env = { ADMIN_DB: unavailableDatabase, ASSETS: { fetch: () => new Response("not used") }, ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: "test-audience" };
  const unauthenticated = await worker.fetch(new Request("https://esenciahair.co.nz/api/admin/prices", { method: "PATCH", headers: { Origin: "https://esenciahair.co.nz", "Content-Type": "application/json" }, body: "{}" }), env);
  assert.equal(unauthenticated.status, 401);

  const { token, jwk } = await accessFixture(teamDomain);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }));
  try {
    const crossOrigin = await worker.fetch(new Request("https://esenciahair.co.nz/api/admin/prices", { method: "PATCH", headers: { Origin: "https://attacker.example", "Content-Type": "application/json", "CF-Access-Jwt-Assertion": token }, body: JSON.stringify({ key: "keratin-short", amountCents: 19000, version: 1 }) }), env);
    assert.equal(crossOrigin.status, 403);
    const malformed = await worker.fetch(new Request("https://esenciahair.co.nz/api/admin/prices", { method: "PATCH", headers: { Origin: "https://esenciahair.co.nz", "Content-Type": "application/json", "CF-Access-Jwt-Assertion": token }, body: "{" }), env);
    assert.equal(malformed.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serves static HTML unchanged when D1 price loading fails", async () => {
  const worker = createWorker();
  const fallback = '<!doctype html><strong data-price-key="keratin-short">from $180</strong>';
  const env = {
    ADMIN_DB: { prepare() { return { all() { throw new Error("D1 unavailable"); } }; } },
    ASSETS: { fetch: async () => new Response(fallback, { headers: { "Content-Type": "text/html; charset=utf-8" } }) },
  };
  const response = await worker.fetch(new Request("https://esenciahair.co.nz/keratin"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), fallback);
});
