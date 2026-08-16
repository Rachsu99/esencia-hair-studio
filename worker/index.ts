import { dashboardHtml, loginHtml } from "./admin-html";
import { DEFAULT_CONTENT, type GalleryContent, type ServiceContent, type SiteContent } from "./default-content";

const COOKIE_NAME = "esencia_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_FAILURES = 5;
const encoder = new TextEncoder();

type ContentRow = { data: string; updated_at: string };
type SessionRow = { token_hash: string; csrf_hash: string; expires_at: number };
type AttemptRow = { fingerprint: string; window_started_at: number; failures: number; locked_until: number };

const securityHeaders = (admin = false): HeadersInit => ({
  "Content-Security-Policy": admin
    ? "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
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
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(true),
      ...extraHeaders,
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      ...securityHeaders(true),
    },
  });
}

function cloneDefaultContent(): SiteContent {
  return JSON.parse(JSON.stringify(DEFAULT_CONTENT)) as SiteContent;
}

async function ensureSchema(env: Env): Promise<void> {
  await env.ADMIN_DB.batch([
    env.ADMIN_DB.prepare("CREATE TABLE IF NOT EXISTS site_content (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    env.ADMIN_DB.prepare("CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, csrf_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)"),
    env.ADMIN_DB.prepare("CREATE TABLE IF NOT EXISTS admin_login_attempts (fingerprint TEXT PRIMARY KEY, window_started_at INTEGER NOT NULL, failures INTEGER NOT NULL, locked_until INTEGER NOT NULL)"),
  ]);
  await env.ADMIN_DB.prepare("INSERT OR IGNORE INTO site_content (id, data, updated_at) VALUES (1, ?, ?)")
    .bind(JSON.stringify(DEFAULT_CONTENT), DEFAULT_CONTENT.updatedAt)
    .run();
}

async function loadContent(env: Env): Promise<SiteContent> {
  try {
    const row = await env.ADMIN_DB.prepare("SELECT data, updated_at FROM site_content WHERE id = 1").first<ContentRow>();
    if (!row) return cloneDefaultContent();
    const content = JSON.parse(row.data) as SiteContent;
    content.updatedAt = row.updated_at;
    return content;
  } catch {
    return cloneDefaultContent();
  }
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => Boolean(name && value))
      .map(([name, ...value]) => [name, decodeURIComponent(value.join("="))])
  );
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function toBase64(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  return toBase64(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return constantTimeBytes(new Uint8Array(leftHash), new Uint8Array(rightHash));
}

function constantTimeBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) difference |= (left[index % left.length] || 0) ^ (right[index % right.length] || 0);
  return difference === 0;
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, expectedText] = encodedHash.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const actual = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltText), iterations }, key, 256);
    const expected = fromBase64(expectedText);
    return constantTimeBytes(new Uint8Array(actual), expected);
  } catch {
    return false;
  }
}

function cookieHeader(token: string, request: Request, maxAge = SESSION_SECONDS): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function getSession(request: Request, env: Env): Promise<SessionRow | null> {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token || token.length > 256) return null;
  try {
    const tokenHash = await sha256(token);
    const row = await env.ADMIN_DB.prepare("SELECT token_hash, csrf_hash, expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > ?")
      .bind(tokenHash, Math.floor(Date.now() / 1000))
      .first<SessionRow>();
    return row || null;
  } catch {
    return null;
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function requireSession(request: Request, env: Env, requireCsrf = false): Promise<SessionRow | Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Authentication required." }, 401);
  if (requireCsrf) {
    if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
    const supplied = request.headers.get("X-CSRF-Token") || "";
    if (!supplied || !(await constantTimeEqual(await sha256(supplied), session.csrf_hash))) {
      return json({ error: "Invalid security token." }, 403);
    }
  }
  return session;
}

async function boundedJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 64_000) throw new Error("Request is too large.");
  const text = await request.text();
  if (text.length > 64_000) throw new Error("Request is too large.");
  return JSON.parse(text);
}

async function fingerprint(request: Request, env: Env): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  return hmac(ip, env.SESSION_SECRET);
}

async function login(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) {
    return json({ error: "Admin authentication is not configured." }, 503);
  }
  await ensureSchema(env);
  const key = await fingerprint(request, env);
  const now = Math.floor(Date.now() / 1000);
  const attempt = await env.ADMIN_DB.prepare("SELECT fingerprint, window_started_at, failures, locked_until FROM admin_login_attempts WHERE fingerprint = ?")
    .bind(key)
    .first<AttemptRow>();
  if (attempt && attempt.locked_until > now) {
    return json({ error: "Too many attempts. Please try again later." }, 429, { "Retry-After": String(attempt.locked_until - now) });
  }

  let payload: unknown;
  try {
    payload = await boundedJson(request);
  } catch {
    return json({ error: "Invalid login request." }, 400);
  }
  const candidate = payload as { username?: unknown; password?: unknown };
  const username = typeof candidate.username === "string" ? candidate.username.slice(0, 80) : "";
  const password = typeof candidate.password === "string" ? candidate.password.slice(0, 256) : "";
  const [usernameOk, passwordOk] = await Promise.all([
    constantTimeEqual(username, env.ADMIN_USERNAME),
    verifyPassword(password, env.ADMIN_PASSWORD_HASH),
  ]);

  if (!usernameOk || !passwordOk) {
    const withinWindow = Boolean(attempt && now - attempt.window_started_at < LOGIN_WINDOW_SECONDS);
    const failures = withinWindow && attempt ? attempt.failures + 1 : 1;
    const windowStarted = withinWindow && attempt ? attempt.window_started_at : now;
    const lockedUntil = failures >= MAX_LOGIN_FAILURES ? now + LOGIN_WINDOW_SECONDS : 0;
    await env.ADMIN_DB.prepare("INSERT INTO admin_login_attempts (fingerprint, window_started_at, failures, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(fingerprint) DO UPDATE SET window_started_at = excluded.window_started_at, failures = excluded.failures, locked_until = excluded.locked_until")
      .bind(key, windowStarted, failures, lockedUntil)
      .run();
    return json({ error: "Invalid username or password." }, 401);
  }

  await env.ADMIN_DB.prepare("DELETE FROM admin_login_attempts WHERE fingerprint = ?").bind(key).run();
  const token = randomToken();
  const csrf = randomToken();
  await env.ADMIN_DB.prepare("INSERT INTO admin_sessions (token_hash, csrf_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), await sha256(csrf), now + SESSION_SECONDS, now)
    .run();
  return json({ ok: true, csrf }, 200, { "Set-Cookie": cookieHeader(token, request) });
}

function plainText(value: unknown, maximum: number, required = false): string {
  if (typeof value !== "string") throw new Error("Expected text value.");
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if ((required && !clean) || clean.length > maximum || /[<>]/.test(clean)) throw new Error("Invalid text value.");
  return clean;
}

function safeHttpsUrl(value: unknown, required = false): string {
  const text = plainText(value, 500, required);
  if (!text) return "";
  const url = new URL(text);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only secure HTTPS URLs are allowed.");
  return url.toString();
}

function validateService(raw: unknown, fallback: ServiceContent): ServiceContent {
  const value = raw as Partial<ServiceContent>;
  if (!value || value.slug !== fallback.slug || !Array.isArray(value.prices) || value.prices.length !== fallback.prices.length) throw new Error("Invalid service data.");
  return {
    slug: fallback.slug,
    name: plainText(value.name, 80, true),
    summary: plainText(value.summary, 360, true),
    description: plainText(value.description, 600, true),
    startingPrice: plainText(value.startingPrice, 40, true),
    category: plainText(value.category, 80, true),
    visible: value.visible === true,
    prices: value.prices.map((price, index) => ({
      label: plainText(price?.label, 80, true),
      price: plainText(price?.price, 40, true),
    })),
  };
}

function validateGallery(raw: unknown, fallback: GalleryContent): GalleryContent {
  const value = raw as Partial<GalleryContent>;
  if (!value || value.id !== fallback.id || value.image !== fallback.image) throw new Error("Invalid gallery data.");
  return {
    id: fallback.id,
    image: fallback.image,
    title: plainText(value.title, 100, true),
    alt: plainText(value.alt, 180, true),
    category: plainText(value.category, 80, true),
    visible: value.visible === true,
  };
}

function validateContent(raw: unknown, current: SiteContent): SiteContent {
  const value = raw as Partial<SiteContent>;
  if (!value || !value.services || !Array.isArray(value.gallery) || !value.contact || !value.seo) throw new Error("Invalid content payload.");
  const serviceEntries = Object.entries(current.services).map(([slug, fallback]) => [slug, validateService(value.services?.[slug], fallback)]);
  if (value.gallery.length !== current.gallery.length) throw new Error("Invalid gallery payload.");
  const email = plainText(value.contact.email, 254, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address.");
  const ogImage = plainText(value.seo.defaultOgImage, 240, true);
  if (!/^\/assets\/[a-zA-Z0-9_./-]+$/.test(ogImage) || ogImage.includes("..")) throw new Error("Invalid social image path.");
  const canonicalDomain = safeHttpsUrl(value.seo.canonicalDomain, true).replace(/\/$/, "");
  return {
    services: Object.fromEntries(serviceEntries),
    gallery: current.gallery.map((fallback, index) => validateGallery(value.gallery?.[index], fallback)),
    contact: {
      email,
      phone: plainText(value.contact.phone, 40),
      instagram: safeHttpsUrl(value.contact.instagram, true),
      instagramHandle: plainText(value.contact.instagramHandle, 80, true),
      address: plainText(value.contact.address, 240),
      openingHours: plainText(value.contact.openingHours, 240),
      bookingLink: safeHttpsUrl(value.contact.bookingLink),
    },
    seo: {
      homepageTitle: plainText(value.seo.homepageTitle, 70, true),
      metaDescription: plainText(value.seo.metaDescription, 170, true),
      socialDescription: plainText(value.seo.socialDescription, 220, true),
      defaultOgImage: ogImage,
      businessName: plainText(value.seo.businessName, 100, true),
      canonicalDomain,
    },
    updatedAt: new Date().toISOString(),
  };
}

function getPath(content: SiteContent, path: string): unknown {
  let value: unknown = content;
  for (const part of path.split(".")) {
    if (Array.isArray(value)) value = value[Number(part)];
    else if (value && typeof value === "object") value = (value as Record<string, unknown>)[part];
    else return undefined;
  }
  return value;
}

function publicRewriter(content: SiteContent, pathname: string): HTMLRewriter {
  let rewriter = new HTMLRewriter()
    .on("[data-service]", {
      element(element) {
        const slug = element.getAttribute("data-service") || "";
        if (content.services[slug]?.visible) element.removeAttribute("hidden");
        else element.remove();
      },
    })
    .on("[data-content]", {
      element(element) {
        const serviceSlug = element.getAttribute("data-service");
        if (serviceSlug && !content.services[serviceSlug]?.visible) return;
        const value = getPath(content, element.getAttribute("data-content") || "");
        if (typeof value === "string") element.setInnerContent(value);
      },
    })
    .on('a[href^="mailto:"]', {
      element(element) {
        element.setAttribute("href", `mailto:${content.contact.email}`);
      },
    })
    .on('a[href*="instagram.com"]', {
      element(element) {
        element.setAttribute("href", content.contact.instagram);
      },
    })
    .on('a[href="book.html"]', {
      element(element) {
        if (content.contact.bookingLink) element.setAttribute("href", content.contact.bookingLink);
      },
    })
    .on('[data-contact="email"]', {
      element(element) {
        element.setInnerContent(content.contact.email);
      },
    })
    .on('[data-contact="instagram"]', {
      element(element) {
        element.setInnerContent(`${content.contact.instagramHandle} ↗`);
      },
    })
    .on('[data-contact-field="phone"]', {
      element(element) {
        if (!content.contact.phone) element.remove();
        else {
          element.removeAttribute("hidden");
          element.setInnerContent(content.contact.phone);
        }
      },
    })
    .on('[data-contact-field="address"]', {
      element(element) {
        if (!content.contact.address) element.remove();
        else {
          element.removeAttribute("hidden");
          element.setInnerContent(content.contact.address);
        }
      },
    })
    .on('[data-contact-field="openingHours"]', {
      element(element) {
        if (!content.contact.openingHours) element.remove();
        else {
          element.removeAttribute("hidden");
          element.setInnerContent(content.contact.openingHours);
        }
      },
    })
    .on('script[type="application/ld+json"]', {
      element(element) {
        const structuredData: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "HairSalon",
          name: content.seo.businessName,
          url: content.seo.canonicalDomain,
          email: content.contact.email,
          sameAs: [content.contact.instagram],
          priceRange: "$$",
          description: content.seo.metaDescription,
        };
        if (content.contact.phone) structuredData.telephone = content.contact.phone;
        if (content.contact.address) structuredData.address = content.contact.address;
        if (content.contact.openingHours) structuredData.openingHours = content.contact.openingHours;
        const safeJson = JSON.stringify(structuredData).replaceAll("<", "\\u003c");
        element.setInnerContent(safeJson, { html: true });
      },
    })
    .on('link[rel="canonical"]', {
      element(element) {
        const route = pathname === "/index.html" ? "/" : pathname.replace(/\.html$/, "");
        element.setAttribute("href", `${content.seo.canonicalDomain}${route === "/" ? "/" : route}`);
      },
    })
    .on('meta[property="og:site_name"]', { element: (element) => { element.setAttribute("content", content.seo.businessName); } });

  if (pathname === "/" || pathname === "/index.html") {
    rewriter = rewriter
      .on("title", { element: (element) => { element.setInnerContent(content.seo.homepageTitle); } })
      .on('meta[name="description"]', { element: (element) => { element.setAttribute("content", content.seo.metaDescription); } })
      .on('meta[property="og:title"]', { element: (element) => { element.setAttribute("content", content.seo.homepageTitle); } })
      .on('meta[property="og:description"]', { element: (element) => { element.setAttribute("content", content.seo.socialDescription); } })
      .on('meta[name="twitter:title"]', { element: (element) => { element.setAttribute("content", content.seo.homepageTitle); } })
      .on('meta[name="twitter:description"]', { element: (element) => { element.setAttribute("content", content.seo.socialDescription); } })
      .on('meta[property="og:image"]', { element: (element) => { element.setAttribute("content", `${content.seo.canonicalDomain}${content.seo.defaultOgImage}`); } })
      .on('meta[name="twitter:image"]', { element: (element) => { element.setAttribute("content", `${content.seo.canonicalDomain}${content.seo.defaultOgImage}`); } });
  }

  for (const item of content.gallery) {
    rewriter = rewriter
      .on(`[data-gallery-id="${item.id}"]`, {
        element(element) {
          if (!item.visible) element.remove();
          else {
            element.setAttribute("data-gallery-alt", item.alt);
            element.setAttribute("data-gallery-caption", `${item.title} · Editorial image`);
          }
        },
      })
      .on(`[data-gallery-id="${item.id}"] img`, { element: (element) => { element.setAttribute("alt", item.alt); } })
      .on(`[data-gallery-id="${item.id}"] small`, { element: (element) => { element.setInnerContent(item.category); } });
  }
  return rewriter;
}

async function adminApi(request: Request, env: Env, ctx: ExecutionContext, pathname: string): Promise<Response> {
  if (pathname === "/api/admin/login") {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    return login(request, env);
  }
  await ensureSchema(env);
  const requireCsrf = request.method !== "GET" && request.method !== "HEAD";
  const session = await requireSession(request, env, requireCsrf);
  if (session instanceof Response) return session;

  if (pathname === "/api/admin/session" && request.method === "GET") {
    const content = await loadContent(env);
    const csrf = randomToken();
    await env.ADMIN_DB.prepare("UPDATE admin_sessions SET csrf_hash = ? WHERE token_hash = ?")
      .bind(await sha256(csrf), session.token_hash)
      .run();
    return json({
      authenticated: true,
      content,
      status: {
        website: "Live",
        domain: new URL(request.url).hostname,
        ssl: new URL(request.url).protocol === "https:" ? "Active" : "Local development",
        services: Object.values(content.services).filter((service) => service.visible).length,
        galleryItems: content.gallery.filter((item) => item.visible).length,
        lastUpdated: content.updatedAt,
      },
      csrf,
    });
  }

  if (pathname === "/api/admin/content" && request.method === "PUT") {
    try {
      const current = await loadContent(env);
      const updated = validateContent(await boundedJson(request), current);
      await env.ADMIN_DB.prepare("UPDATE site_content SET data = ?, updated_at = ? WHERE id = 1")
        .bind(JSON.stringify(updated), updated.updatedAt)
        .run();
      return json({ ok: true, content: updated });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid content." }, 400);
    }
  }

  if (pathname === "/api/admin/logout" && request.method === "POST") {
    await env.ADMIN_DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(session.token_hash).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", request, 0) });
  }

  ctx.waitUntil(env.ADMIN_DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(Math.floor(Date.now() / 1000)).run());
  return json({ error: "Not found." }, 404);
}

async function serveAdmin(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  return html(session ? dashboardHtml() : loginHtml());
}

async function serveSitemap(request: Request, env: Env): Promise<Response> {
  const content = await loadContent(env);
  const domain = content.seo.canonicalDomain;
  const routes = ["/", "/services", "/gallery", "/about", "/contact", "/book"];
  for (const service of Object.values(content.services)) if (service.visible) routes.splice(2, 0, `/${service.slug}`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${domain}${route}</loc></url>`).join("\n")}\n</urlset>\n`;
  return withHeaders(new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" } }));
}

async function servePublic(request: Request, env: Env, pathname: string): Promise<Response> {
  const content = await loadContent(env);
  const serviceSlug = pathname.replace(/^\//, "").replace(/\.html$/, "").replace(/\/$/, "");
  if (content.services[serviceSlug] && !content.services[serviceSlug].visible) {
    const notFoundRequest = new Request(new URL("/404", request.url), request);
    const notFound = await env.ASSETS.fetch(notFoundRequest);
    return withHeaders(new Response(notFound.body, { status: 404, headers: notFound.headers }));
  }
  const assetHeaders = new Headers(request.headers);
  assetHeaders.delete("If-None-Match");
  assetHeaders.delete("If-Modified-Since");
  const assetResponse = await env.ASSETS.fetch(new Request(request, { headers: assetHeaders }));
  const contentType = assetResponse.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return withHeaders(assetResponse);
  const transformed = publicRewriter(content, pathname).transform(assetResponse);
  const headers = new Headers(transformed.headers);
  headers.set("Cache-Control", "no-store");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  return withHeaders(new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers }));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/admin/")) return await adminApi(request, env, ctx, url.pathname);
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return await serveAdmin(request, env);
      if (url.pathname === "/sitemap.xml") return await serveSitemap(request, env);
      return await servePublic(request, env, url.pathname);
    } catch (error) {
      console.error(JSON.stringify({ message: "request failed", path: url.pathname, error: error instanceof Error ? error.message : "unknown" }));
      if (url.pathname.startsWith("/api/admin/")) return json({ error: "Internal server error." }, 500);
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return html("<main><h1>Admin is temporarily unavailable.</h1></main>", 503);
      return withHeaders(new Response("Service unavailable", { status: 503 }));
    }
  },
} satisfies ExportedHandler<Env>;
