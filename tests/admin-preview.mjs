import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { formatPrice, priceDefinitions } from "../price.config.mjs";
import { dashboardHtml } from "../worker/admin-html.ts";

const root = process.cwd();
const prices = priceDefinitions.map((item) => ({
  key: item.key,
  category: item.category,
  label: item.label,
  amountCents: item.amountCents,
  displayType: item.displayType,
  formatted: formatPrice(item.amountCents, item.displayType),
  editable: item.displayType !== "consultation",
  version: 1,
  updatedAt: new Date(0).toISOString(),
}));

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/admin") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(dashboardHtml("local-admin@example.test", "/admin"));
    return;
  }
  if (url.pathname === "/api/admin/prices" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ prices }));
    return;
  }
  const files = new Map([
    ["/css/admin.css", ["css/admin.css", "text/css; charset=utf-8"]],
    ["/js/admin.js", ["js/admin.js", "text/javascript; charset=utf-8"]],
    ["/assets/images/brand/esencia-logo.webp", ["assets/images/brand/esencia-logo.webp", "image/webp"]],
  ]);
  const file = files.get(url.pathname);
  if (file) {
    response.writeHead(200, { "Content-Type": file[1] });
    createReadStream(path.join(root, file[0])).pipe(response);
    return;
  }
  response.writeHead(404).end();
});

server.listen(8793, "127.0.0.1", () => process.stdout.write("Admin preview: http://127.0.0.1:8793/admin\n"));
