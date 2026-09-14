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
  is_active: number;
  created_at: string;
  description: string | null;
};

export type PriceUpdate = { key: string; amountCents: number; version: number };
export type StylingItemInput = { key: string | null; label: string; amountCents: number; version: number | null };
export type StylingBatchInput = { items: StylingItemInput[]; removed: Array<{ key: string; version: number }> };
const MAX_BODY_BYTES = 16_384;
const MAX_PRICE_CENTS = 5_000_000;

const securityHeaders = (admin = false): HeadersInit => ({
  "Content-Security-Policy": admin
    ? "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://*.cloudflareaccess.com"
    : "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-src https://www.openstreetmap.org; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
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

const PRICE_COLUMNS = "price_key, category, label, amount_cents, display_type, sort_order, version, updated_at, updated_by, is_active, created_at, description";

async function loadPrices(database: D1Database, includeInactive = false): Promise<PriceRow[]> {
  const result = await database.prepare(`SELECT ${PRICE_COLUMNS} FROM service_prices ${includeInactive ? "" : "WHERE is_active = 1"} ORDER BY sort_order`).all<PriceRow>();
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
    description: row.description,
  };
}

export function validateStylingBatch(value: unknown): StylingBatchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Styling update.");
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !["items", "removed"].includes(key))) throw new Error("Unknown fields are not allowed.");
  if (!Array.isArray(candidate.items) || !Array.isArray(candidate.removed)) throw new Error("Invalid Styling update.");
  if (candidate.items.length > 30 || candidate.removed.length > 30) throw new Error("Too many Styling options.");
  const items = candidate.items.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid Styling option.");
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).some((key) => !["key", "label", "amountCents", "version"].includes(key))) throw new Error("Unknown Styling fields are not allowed.");
    const key = item.key === null ? null : String(item.key || "");
    if (key !== null && !/^styling-[a-z0-9-]{3,72}$/.test(key)) throw new Error("Invalid Styling key.");
    if (typeof item.label !== "string") throw new Error("Enter a Styling service name.");
    const label = item.label.trim().replace(/\s+/g, " ");
    if (label.length < 2 || label.length > 80 || /[\u0000-\u001f\u007f]/.test(label)) throw new Error("Styling service names must be between 2 and 80 characters.");
    if (!Number.isSafeInteger(item.amountCents) || Number(item.amountCents) < 0 || Number(item.amountCents) > MAX_PRICE_CENTS) throw new Error("Enter a valid Styling price between $0 and $50,000.");
    const version = item.version === null ? null : Number(item.version);
    if (key === null ? version !== null : !Number.isSafeInteger(version) || Number(version) < 1) throw new Error("Invalid Styling version.");
    return { key, label, amountCents: Number(item.amountCents), version };
  });
  const removed = candidate.removed.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid removed Styling option.");
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).some((key) => !["key", "version"].includes(key))) throw new Error("Unknown removal fields are not allowed.");
    if (typeof item.key !== "string" || !/^styling-[a-z0-9-]{3,72}$/.test(item.key)) throw new Error("Invalid Styling key.");
    if (!Number.isSafeInteger(item.version) || Number(item.version) < 1) throw new Error("Invalid Styling version.");
    return { key: item.key, version: Number(item.version) };
  });
  const keys = [...items.flatMap((item) => item.key ? [item.key] : []), ...removed.map((item) => item.key)];
  if (new Set(keys).size !== keys.length) throw new Error("A Styling option was submitted more than once.");
  if (!items.length) throw new Error("Keep at least one Styling option active.");
  return { items, removed };
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
  const existing = await database.prepare(`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE price_key = ? AND is_active = 1`)
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
  return database.prepare(`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE price_key = ? AND is_active = 1`)
    .bind(update.key).first<PriceRow>();
}

async function updateStyling(database: D1Database, input: StylingBatchInput, email: string): Promise<PriceRow[] | null> {
  const currentResult = await database.prepare(`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE category = 'Styling' AND is_active = 1 ORDER BY sort_order`).all<PriceRow>();
  const current = currentResult.results;
  const byKey = new Map(current.map((row) => [row.price_key, row]));
  const submittedKeys = new Set([...input.items.flatMap((item) => item.key ? [item.key] : []), ...input.removed.map((item) => item.key)]);
  if (submittedKeys.size !== current.length || current.some((row) => !submittedKeys.has(row.price_key))) return null;
  for (const item of [...input.items, ...input.removed]) {
    if (!("key" in item) || !item.key) continue;
    const row = byKey.get(item.key);
    if (!row || row.version !== item.version) return null;
  }

  const changedAt = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const requiredChangeIndexes: number[] = [];
  input.items.forEach((item, index) => {
    const sortOrder = 150 + index * 10;
    if (item.key === null) {
      const key = `styling-${crypto.randomUUID()}`;
      statements.push(
        database.prepare("INSERT INTO service_prices (price_key, category, label, amount_cents, display_type, sort_order, version, updated_at, updated_by, is_active, created_at, description) VALUES (?, 'Styling', ?, ?, 'fixed', ?, 1, ?, ?, 1, ?, NULL)")
          .bind(key, item.label, item.amountCents, sortOrder, changedAt, email, changedAt),
        database.prepare("INSERT INTO styling_audit (price_key, action, new_label, new_amount_cents, new_sort_order, new_is_active, changed_at, changed_by) VALUES (?, 'create', ?, ?, ?, 1, ?, ?)")
          .bind(key, item.label, item.amountCents, sortOrder, changedAt, email),
      );
      return;
    }
    const old = byKey.get(item.key)!;
    const changed = old.label !== item.label || old.amount_cents !== item.amountCents || old.sort_order !== sortOrder;
    if (!changed) return;
    const action = old.label !== item.label || old.amount_cents !== item.amountCents ? "update" : "reorder";
    requiredChangeIndexes.push(statements.length);
    statements.push(
      database.prepare("UPDATE service_prices SET label = ?, amount_cents = ?, sort_order = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE price_key = ? AND category = 'Styling' AND is_active = 1 AND version = ?")
        .bind(item.label, item.amountCents, sortOrder, changedAt, email, item.key, item.version),
      database.prepare("INSERT INTO styling_audit (price_key, action, old_label, new_label, old_amount_cents, new_amount_cents, old_sort_order, new_sort_order, old_is_active, new_is_active, changed_at, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)")
        .bind(item.key, action, old.label, item.label, old.amount_cents, item.amountCents, old.sort_order, sortOrder, changedAt, email),
    );
    if (old.amount_cents !== item.amountCents) {
      statements.push(database.prepare("INSERT INTO price_audit (price_key, old_amount_cents, new_amount_cents, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)")
        .bind(item.key, old.amount_cents, item.amountCents, changedAt, email));
    }
  });
  input.removed.forEach((item) => {
    const old = byKey.get(item.key)!;
    requiredChangeIndexes.push(statements.length);
    statements.push(
      database.prepare("UPDATE service_prices SET is_active = 0, version = version + 1, updated_at = ?, updated_by = ? WHERE price_key = ? AND category = 'Styling' AND is_active = 1 AND version = ?")
        .bind(changedAt, email, item.key, item.version),
      database.prepare("INSERT INTO styling_audit (price_key, action, old_label, old_amount_cents, old_sort_order, old_is_active, new_is_active, changed_at, changed_by) VALUES (?, 'remove', ?, ?, ?, 1, 0, ?, ?)")
        .bind(item.key, old.label, old.amount_cents, old.sort_order, changedAt, email),
    );
  });
  if (statements.length) {
    const results = await database.batch(statements);
    if (requiredChangeIndexes.some((index) => Number(results[index]?.meta?.changes || 0) !== 1)) return null;
  }
  const refreshed = await database.prepare(`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE category = 'Styling' AND is_active = 1 ORDER BY sort_order`).all<PriceRow>();
  return refreshed.results;
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

async function adminStyling(request: Request, env: RuntimeEnv): Promise<Response> {
  const identity = await accessIdentity(request, env);
  if (identity instanceof Response) return identity;
  if (request.method !== "PUT") return json({ error: "Method not allowed." }, 405, { Allow: "PUT" });
  if (!sameAllowedOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  try {
    const input = validateStylingBatch(await readJson(request));
    const updated = await updateStyling(env.ADMIN_DB, input, identity.email);
    if (!updated) return json({ error: "Styling options changed in another session. Refresh and try again." }, 409);
    return json({ ok: true, prices: updated.map(presentPrice) });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Malformed JSON." }, 400);
    return json({ error: error instanceof Error ? error.message : "Invalid Styling update." }, 400);
  }
}

function rewriteStructuredData(source: string, service: string, prices: Map<string, PriceRow>): string {
  try {
    const data = JSON.parse(source) as { "@graph"?: Array<Record<string, unknown>> };
    const serviceNode = data["@graph"]?.find((item) => item["@type"] === "Service");
    if (!serviceNode) return source;
    if (service === "styling") {
      serviceNode.offers = [...prices.values()]
        .filter((row) => row.category === "Styling" && row.is_active === 1)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((row) => ({
          "@type": "Offer",
          name: row.label,
          priceCurrency: "NZD",
          ...(row.amount_cents === null ? {} : { price: Number.isInteger(row.amount_cents / 100) ? String(row.amount_cents / 100) : (row.amount_cents / 100).toFixed(2) }),
          description: formatPrice(row.amount_cents, row.display_type),
        }));
      return JSON.stringify(data).replaceAll("<", "\\u003c");
    }
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

const escapePublicHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function renderStylingOptions(rows: PriceRow[], variant: string): string {
  return rows
    .filter((row) => row.category === "Styling" && row.is_active === 1)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => {
      const label = escapePublicHtml(row.label);
      const price = escapePublicHtml(formatPrice(row.amount_cents, row.display_type));
      const description = row.description ? `<small${variant === "services" ? ' class="all-prices__detail"' : ""}>${escapePublicHtml(row.description)}</small>` : "";
      if (variant === "services") return `<div><span>${label}</span><strong>${price}</strong>${description}</div>`;
      return `<div class="price-row price-row--detail"><span>${label}</span><strong>${price}</strong>${description}</div>`;
    })
    .join("");
}

function priceRewriter(rows: PriceRow[]): HTMLRewriter {
  const prices = new Map(rows.map((row) => [row.price_key, row]));
  let schemaSource = "";
  let schemaService = "";
  return new HTMLRewriter()
    .on("[data-styling-options]", {
      element(element) {
        const styling = rows.filter((row) => row.category === "Styling" && row.is_active === 1);
        if (styling.length) element.setInnerContent(renderStylingOptions(styling, element.getAttribute("data-styling-options") || "detail"), { html: true });
      },
    })
    .on("[data-styling-starting-price]", {
      element(element) {
        const amounts = rows.filter((row) => row.category === "Styling" && row.is_active === 1 && row.display_type === "fixed" && row.amount_cents !== null).map((row) => row.amount_cents as number);
        if (amounts.length) element.setInnerContent(`from ${formatPrice(Math.min(...amounts), "fixed")}`);
      },
    })
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
        if (url.pathname === "/api/admin/styling") return await adminStyling(request, env);
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
