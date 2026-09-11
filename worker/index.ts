import { formatPrice, priceDefinitions, priceKeyFor } from "../price.config.mjs";
import { authenticateAccessRequest, cloudflareLogoutUrl, type AccessIdentity } from "./access-auth.ts";
import { dashboardHtml } from "./admin-html.ts";

type RuntimeEnv = {
  ADMIN_DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
};

export type PriceRow = {
  price_key: string;
  category: string;
  label: string;
  amount_cents: number | null;
  display_type: "fixed" | "from" | "surcharge" | "consultation";
  sort_order: number;
  version: number;
  updated_at: string;
  updated_by: string;
};

export type PriceUpdate = { key: string; amountCents: number; version: number };
const MAX_BODY_BYTES = 16_384;
const MAX_PRICE_CENTS = 5_000_000;

const securityHeaders = (admin = false): HeadersInit => ({
  "Content-Security-Policy": admin
    ? "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://*.cloudflareaccess.com"
    : "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": admin ? "no-referrer" : "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": admin ? "DENY" : "SAMEORIGIN",
  ...(admin ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {}),
});

function withHeaders(response: Response, admin = false): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(admin))) headers.set(name, String(value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", ...securityHeaders(true), ...extraHeaders },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8", ...securityHeaders(true) } });
}

export function validatePriceUpdate(value: unknown): PriceUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid price update.");
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !["key", "amountCents", "version"].includes(key))) throw new Error("Unknown fields are not allowed.");
  if (typeof candidate.key !== "string" || !/^[a-z0-9-]{3,80}$/.test(candidate.key)) throw new Error("Invalid price key.");
  const definition = priceDefinitions.find((item) => item.key === candidate.key);
  if (!definition) throw new Error("Unknown price key.");
  if (definition.displayType === "consultation") throw new Error("Consultation pricing is not numerically editable.");
  if (!Number.isSafeInteger(candidate.amountCents) || Number(candidate.amountCents) < 0 || Number(candidate.amountCents) > MAX_PRICE_CENTS) throw new Error("Enter a valid price between $0 and $50,000.");
  if (!Number.isSafeInteger(candidate.version) || Number(candidate.version) < 1) throw new Error("Invalid price version.");
  return { key: candidate.key, amountCents: Number(candidate.amountCents), version: Number(candidate.version) };
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new Error("Content-Type must be application/json.");
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Request is too large.");
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) throw new Error("Request is too large.");
  return JSON.parse(body);
}

async function loadPrices(database: D1Database): Promise<PriceRow[]> {
  const result = await database.prepare("SELECT price_key, category, label, amount_cents, display_type, sort_order, version, updated_at, updated_by FROM service_prices ORDER BY sort_order").all<PriceRow>();
  return result.results;
}

function presentPrice(row: PriceRow) {
  return {
    key: row.price_key,
    category: row.category,
    label: row.label,
    amountCents: row.amount_cents,
    displayType: row.display_type,
    formatted: formatPrice(row.amount_cents, row.display_type),
    editable: row.display_type !== "consultation",
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function sameAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") return origin === url.origin;
  return origin === "https://esenciahair.co.nz";
}

async function accessIdentity(request: Request, env: RuntimeEnv): Promise<AccessIdentity | Response> {
  try {
    return await authenticateAccessRequest(request, { teamDomain: env.ACCESS_TEAM_DOMAIN || "", audience: env.ACCESS_AUD || "" });
  } catch (error) {
    console.warn(JSON.stringify({ message: "Access authentication rejected", reason: error instanceof Error ? error.message : "unknown" }));
    return json({ error: "Cloudflare Access authentication is required." }, 401);
  }
}

export async function updatePrice(database: D1Database, update: PriceUpdate, email: string): Promise<PriceRow | null> {
  const existing = await database.prepare("SELECT price_key, category, label, amount_cents, display_type, sort_order, version, updated_at, updated_by FROM service_prices WHERE price_key = ?")
    .bind(update.key).first<PriceRow>();
  if (!existing || existing.version !== update.version) return null;
  const changedAt = new Date().toISOString();
  const newVersion = update.version + 1;
  const results = await database.batch([
    database.prepare("UPDATE service_prices SET amount_cents = ?, version = ?, updated_at = ?, updated_by = ? WHERE price_key = ? AND version = ?")
      .bind(update.amountCents, newVersion, changedAt, email, update.key, update.version),
    database.prepare("INSERT INTO price_audit (price_key, old_amount_cents, new_amount_cents, changed_at, changed_by) SELECT price_key, ?, ?, ?, ? FROM service_prices WHERE price_key = ? AND version = ? AND updated_at = ? AND updated_by = ?")
      .bind(existing.amount_cents, update.amountCents, changedAt, email, update.key, newVersion, changedAt, email),
  ]);
  if (Number(results[0]?.meta?.changes || 0) !== 1) return null;
  return database.prepare("SELECT price_key, category, label, amount_cents, display_type, sort_order, version, updated_at, updated_by FROM service_prices WHERE price_key = ?")
    .bind(update.key).first<PriceRow>();
}

async function adminPrices(request: Request, env: RuntimeEnv): Promise<Response> {
  const identity = await accessIdentity(request, env);
  if (identity instanceof Response) return identity;
  if (request.method === "GET") return json({ prices: (await loadPrices(env.ADMIN_DB)).map(presentPrice) });
  if (request.method !== "PATCH") return json({ error: "Method not allowed." }, 405, { Allow: "GET, PATCH" });
  if (!sameAllowedOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  try {
    const update = validatePriceUpdate(await readJson(request));
    const updated = await updatePrice(env.ADMIN_DB, update, identity.email);
    if (!updated) return json({ error: "Pricing changed in another session. Refresh and try again." }, 409);
    return json({ ok: true, price: presentPrice(updated) });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Malformed JSON." }, 400);
    return json({ error: error instanceof Error ? error.message : "Invalid price update." }, 400);
  }
}

function rewriteStructuredData(source: string, service: string, prices: Map<string, PriceRow>): string {
  try {
    const data = JSON.parse(source) as { "@graph"?: Array<Record<string, unknown>> };
    const serviceNode = data["@graph"]?.find((item) => item["@type"] === "Service");
    if (!serviceNode) return source;
    const offers = Array.isArray(serviceNode.offers) ? serviceNode.offers as Array<Record<string, unknown>> : [];
    offers.forEach((offer, index) => {
      const key = priceKeyFor(service, index);
      const row = prices.get(key);
      if (!row) return;
      offer.description = formatPrice(row.amount_cents, row.display_type);
      if (row.amount_cents === null) delete offer.price;
      else offer.price = Number.isInteger(row.amount_cents / 100) ? String(row.amount_cents / 100) : (row.amount_cents / 100).toFixed(2);
    });
    return JSON.stringify(data).replaceAll("<", "\\u003c");
  } catch {
    return source;
  }
}

function priceRewriter(rows: PriceRow[]): HTMLRewriter {
  const prices = new Map(rows.map((row) => [row.price_key, row]));
  let schemaSource = "";
  let schemaService = "";
  return new HTMLRewriter()
    .on("[data-price-key]", {
      element(element) {
        const row = prices.get(element.getAttribute("data-price-key") || "");
        if (!row) return;
        const variant = element.getAttribute("data-price-variant");
        let formatted = formatPrice(row.amount_cents, variant === "fixed" ? "fixed" : row.display_type);
        if (variant === "capitalize") formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
        element.setInnerContent(formatted);
      },
    })
    .on("script[data-service-schema]", {
      element(element) { schemaService = element.getAttribute("data-service-schema") || ""; schemaSource = ""; },
      text(chunk) {
        schemaSource += chunk.text;
        chunk.remove();
        if (chunk.lastInTextNode) chunk.after(rewriteStructuredData(schemaSource, schemaService, prices), { html: true });
      },
    });
}

async function servePublic(request: Request, env: RuntimeEnv): Promise<Response> {
  const asset = await env.ASSETS.fetch(request);
  if (!(asset.headers.get("Content-Type") || "").includes("text/html")) return withHeaders(asset);
  try {
    const prices = await loadPrices(env.ADMIN_DB);
    const transformed = priceRewriter(prices).transform(asset);
    const headers = new Headers(transformed.headers);
    headers.set("Cache-Control", "no-store");
    headers.delete("ETag");
    headers.delete("Last-Modified");
    return withHeaders(new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers }));
  } catch (error) {
    console.error(JSON.stringify({ message: "Price injection failed; serving static fallback", reason: error instanceof Error ? error.message : "unknown" }));
    return withHeaders(asset);
  }
}

async function serveAdmin(request: Request, env: RuntimeEnv): Promise<Response> {
  const identity = await accessIdentity(request, env);
  if (identity instanceof Response) return html("<main><h1>Cloudflare Access authentication is required.</h1></main>", identity.status);
  return html(dashboardHtml(identity.email, cloudflareLogoutUrl()));
}

export function createWorker() {
  return {
    async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
      const url = new URL(request.url);
      try {
        if (url.pathname === "/api/prices") {
          if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { Allow: "GET" });
          return json({ prices: (await loadPrices(env.ADMIN_DB)).map((row) => ({ key: row.price_key, formatted: formatPrice(row.amount_cents, row.display_type) })) });
        }
        if (url.pathname === "/api/admin/prices") return await adminPrices(request, env);
        if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return await serveAdmin(request, env);
        return await servePublic(request, env);
      } catch (error) {
        console.error(JSON.stringify({ message: "Request failed", path: url.pathname, reason: error instanceof Error ? error.message : "unknown" }));
        if (url.pathname.startsWith("/api/")) return json({ error: "The service is temporarily unavailable." }, 503);
        if (url.pathname.startsWith("/admin")) return html("<main><h1>Admin is temporarily unavailable.</h1></main>", 503);
        return servePublic(request, env);
      }
    },
  } satisfies ExportedHandler<RuntimeEnv>;
}

export default createWorker();
