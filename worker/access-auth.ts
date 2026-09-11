const encoder = new TextEncoder();
const keyCache = new Map<string, { expires: number; keys: JsonWebKey[] }>();

export type AccessIdentity = { email: string; subject: string };
export type AccessConfig = { teamDomain: string; audience: string };

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parsePart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(part))) as T;
}

function normalizeTeamDomain(value: string): string {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("Invalid Access team domain.");
  if (url.username || url.password || url.pathname !== "/") throw new Error("Invalid Access team domain.");
  return url.origin;
}

async function loadKeys(teamDomain: string, fetcher: typeof fetch): Promise<JsonWebKey[]> {
  const cached = keyCache.get(teamDomain);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetcher(`${teamDomain}/cdn-cgi/access/certs`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Unable to load Cloudflare Access signing keys.");
  const payload = await response.json() as { keys?: JsonWebKey[] };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) throw new Error("Cloudflare Access signing keys are unavailable.");
  keyCache.set(teamDomain, { keys: payload.keys, expires: Date.now() + 5 * 60 * 1000 });
  return payload.keys;
}

export async function verifyAccessJwt(token: string, config: AccessConfig, fetcher: typeof fetch = fetch): Promise<AccessIdentity> {
  if (!token || token.length > 16_384) throw new Error("Cloudflare Access authentication is required.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Cloudflare Access token.");
  const header = parsePart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = parsePart<{ aud?: string | string[]; email?: string; exp?: number; iat?: number; nbf?: number; iss?: string; sub?: string }>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Cloudflare Access token.");

  const teamDomain = normalizeTeamDomain(config.teamDomain);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = Math.floor(Date.now() / 1000);
  if (!audiences.includes(config.audience)) throw new Error("Cloudflare Access audience mismatch.");
  if (payload.iss !== teamDomain && payload.iss !== `${teamDomain}/`) throw new Error("Cloudflare Access issuer mismatch.");
  if (!Number.isFinite(payload.exp) || Number(payload.exp) <= now) throw new Error("Cloudflare Access token has expired.");
  if (Number.isFinite(payload.nbf) && Number(payload.nbf) > now + 60) throw new Error("Cloudflare Access token is not active.");
  if (!payload.email || !payload.sub) throw new Error("Cloudflare Access identity is incomplete.");

  const jwk = (await loadKeys(teamDomain, fetcher)).find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) throw new Error("Cloudflare Access signing key was not found.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error("Invalid Cloudflare Access signature.");
  return { email: payload.email, subject: payload.sub };
}

export function accessTokenFromRequest(request: Request): string {
  const header = request.headers.get("CF-Access-Jwt-Assertion");
  if (header) return header;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function authenticateAccessRequest(
  request: Request,
  config: AccessConfig,
  fetcher: typeof fetch = fetch,
): Promise<AccessIdentity> {
  if (!config.teamDomain || !config.audience) throw new Error("Cloudflare Access is not configured.");
  return verifyAccessJwt(accessTokenFromRequest(request), config, fetcher);
}

export function cloudflareLogoutUrl(): string {
  return "/cdn-cgi/access/logout";
}
