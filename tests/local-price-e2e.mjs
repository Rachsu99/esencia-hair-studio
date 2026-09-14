import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const workerPort = 8791;
const keysPort = 8792;
const workerOrigin = `http://127.0.0.1:${workerPort}`;
const teamDomain = `http://127.0.0.1:${keysPort}`;
const audience = "local-esencia-price-admin";
const kid = "local-e2e-key";
const base64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

const keyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
Object.assign(jwk, { kid, alg: "RS256", use: "sig" });
const now = Math.floor(Date.now() / 1000);
const jwtHeader = base64url({ alg: "RS256", kid, typ: "JWT" });
const jwtPayload = base64url({ aud: [audience], email: "local-admin@example.test", exp: now + 600, iat: now, iss: `${teamDomain}/`, sub: "local-admin" });
const unsignedJwt = `${jwtHeader}.${jwtPayload}`;
const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, new TextEncoder().encode(unsignedJwt));
const token = `${unsignedJwt}.${Buffer.from(signature).toString("base64url")}`;
const accessHeaders = { "CF-Access-Jwt-Assertion": token };

const keyServer = createServer((request, response) => {
  if (request.url === "/cdn-cgi/access/certs") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ keys: [jwk] }));
    return;
  }
  response.writeHead(404).end();
});
keyServer.listen(keysPort, "127.0.0.1");
await once(keyServer, "listening");

const wranglerBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const worker = spawn(process.execPath, [wranglerBin, "dev", "--local", "--ip", "127.0.0.1", "--port", String(workerPort), "--var", `ACCESS_TEAM_DOMAIN:${teamDomain}`, "--var", `ACCESS_AUD:${audience}`], {
  cwd: root,
  env: { ...process.env, NO_COLOR: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let workerOutput = "";
worker.stdout.on("data", (chunk) => { workerOutput += chunk.toString(); });
worker.stderr.on("data", (chunk) => { workerOutput += chunk.toString(); });

async function waitForWorker() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (worker.exitCode !== null) throw new Error(`Wrangler stopped before becoming ready.\n${workerOutput}`);
    try {
      const response = await fetch(`${workerOrigin}/api/prices`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Wrangler did not become ready.\n${workerOutput}`);
}

async function adminRequest(pathname, options = {}) {
  return fetch(`${workerOrigin}${pathname}`, { ...options, headers: { ...accessHeaders, ...(options.headers || {}) } });
}

try {
  await waitForWorker();
  const adminPage = await adminRequest("/admin");
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /<h1 id="admin-title">Pricing<\/h1>/);

  const pricesResponse = await adminRequest("/api/admin/prices");
  assert.equal(pricesResponse.status, 200);
  const prices = (await pricesResponse.json()).prices;
  const original = prices.find((price) => price.key === "keratin-short");
  assert.equal(original.amountCents, 18000);

  const updateResponse = await adminRequest("/api/admin/prices", {
    method: "PATCH",
    headers: { Origin: workerOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ key: original.key, amountCents: 19000, version: original.version }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = (await updateResponse.json()).price;
  assert.equal(updated.formatted, "from $190");

  for (const pathname of ["/", "/services", "/keratin"]) {
    const html = await (await fetch(`${workerOrigin}${pathname}`)).text();
    assert.match(html, /data-price-key="keratin-short">from \$190/i, `${pathname} should use the updated D1 price`);
    assert.doesNotMatch(html, /data-price-key="keratin-short">from \$180/i, `${pathname} should not retain the old linked price`);
    if (pathname === "/keratin") {
      assert.match(html, /"price":"190"/i, "Keratin structured data should use the updated numeric price");
      assert.match(html, /"description":"from \$190"/i, "Keratin structured data should use the updated display price");
    }
  }

  const staleResponse = await adminRequest("/api/admin/prices", {
    method: "PATCH",
    headers: { Origin: workerOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ key: original.key, amountCents: 20000, version: original.version }),
  });
  assert.equal(staleResponse.status, 409);

  const restoreResponse = await adminRequest("/api/admin/prices", {
    method: "PATCH",
    headers: { Origin: workerOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ key: updated.key, amountCents: 18000, version: updated.version }),
  });
  assert.equal(restoreResponse.status, 200);
  assert.equal((await restoreResponse.json()).price.formatted, "from $180");

  for (const pathname of ["/", "/services", "/keratin"]) {
    const html = await (await fetch(`${workerOrigin}${pathname}`)).text();
    assert.match(html, /data-price-key="keratin-short">from \$180/i, `${pathname} should be restored to the source price`);
  }

  const refreshedPrices = (await (await adminRequest("/api/admin/prices")).json()).prices;
  const originalStyling = refreshedPrices.filter((price) => price.category === "Styling");
  assert.equal(originalStyling.length, 3);
  const putStyling = (items, removed = []) => adminRequest("/api/admin/styling", {
    method: "PUT",
    headers: { Origin: workerOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map(({ key, label, amountCents, version }) => ({ key, label, amountCents, version })), removed }),
  });
  const addedResponse = await putStyling([...originalStyling, { key: null, label: "Event Styling", amountCents: 7500, version: null }]);
  assert.equal(addedResponse.status, 200);
  const withAdded = (await addedResponse.json()).prices;
  const added = withAdded.find((price) => price.label === "Event Styling");
  assert.ok(added?.key.startsWith("styling-"));
  for (const pathname of ["/services", "/styling"]) {
    const html = await (await fetch(`${workerOrigin}${pathname}`)).text();
    assert.match(html, /Event Styling/);
    assert.match(html, /\$75/);
  }

  const renamedResponse = await putStyling([
    { ...added, label: "Event Finish", amountCents: 7600 },
    ...withAdded.filter((price) => price.key !== added.key),
  ]);
  assert.equal(renamedResponse.status, 200);
  const renamedList = (await renamedResponse.json()).prices;
  const renamed = renamedList.find((price) => price.key === added.key);
  assert.equal(renamed.label, "Event Finish");
  assert.equal(renamed.amountCents, 7600);

  const staleResponseForStyling = await putStyling([
    { ...renamed, version: added.version },
    ...renamedList.filter((price) => price.key !== renamed.key),
  ]);
  assert.equal(staleResponseForStyling.status, 409);

  const removeResponse = await putStyling(renamedList.filter((price) => price.key !== renamed.key), [{ key: renamed.key, version: renamed.version }]);
  assert.equal(removeResponse.status, 200);
  const restoredStyling = (await removeResponse.json()).prices;
  assert.equal(restoredStyling.length, 3);
  assert.deepEqual(restoredStyling.map(({ key, label, amountCents }) => ({ key, label, amountCents })).sort((a, b) => a.key.localeCompare(b.key)), originalStyling.map(({ key, label, amountCents }) => ({ key, label, amountCents })).sort((a, b) => a.key.localeCompare(b.key)));
  const restoredStylingHtml = await (await fetch(`${workerOrigin}/styling`)).text();
  assert.doesNotMatch(restoredStylingHtml, /Event Styling|Event Finish/);
  process.stdout.write("Local D1 price edit, linked-page update, conflict protection, and restoration: PASS\n");
} finally {
  worker.kill();
  keyServer.close();
  await Promise.allSettled([once(worker, "exit"), once(keyServer, "close")]);
}
