# Esencia Hair Studio

Production website and locally prepared price administration for Esencia Hair Studio.

- Production: `https://esenciahair.co.nz`
- Repository: `Rachsu99/esencia-hair-studio`
- Runtime: Cloudflare Worker with Static Assets and D1
- Build output: `dist`
- Production branch: `main`

This repository is only for Esencia Hair Studio. Never reuse its bindings, database, credentials, or deployment settings in another project.

## Architecture

`scripts/build.mjs` creates the public pages with current static prices as safe fallbacks. Every customer-facing service price also has a stable `data-price-key`. `worker/index.ts` loads all price rows in one D1 query and replaces those values at the edge before HTML reaches the browser. If D1 is unavailable, the unchanged static page is served.

`/admin` is a prices-only interface. `/admin*` and `/api/admin/*` are designed to sit behind Cloudflare Access, and the Worker independently verifies the Access JWT audience, issuer, expiry, and signature. There is no application password or production authentication bypass.

## Local development

Use Node.js 22 or newer.

```text
npm clean-install
npm run build
npx wrangler d1 migrations apply ADMIN_DB --local
npm run dev
```

Cloudflare Access is an edge authentication layer, so authenticated route testing uses signed mock Access tokens only in the automated/local test harness. The production Worker always requires a valid Access JWT.

## Checks

```text
npm run lint
npm test
node tests/local-price-e2e.mjs
npx wrangler deploy --dry-run
```

The end-to-end check changes the local Keratin starting price, confirms every linked public occurrence updates without a rebuild, verifies stale-version conflict protection, then restores the original amount.

## Price administration

The source price catalogue and fallback values live in `price.config.mjs`. D1 schema and seed data live in `migrations/0001_service_prices.sql`. The administrator can edit numeric amounts only; labels, keys, categories, display formats, service copy, visibility, contact details, SEO, and images are not editable in Phase 1.

See `docs/PRICE-MAP.md` for every managed key and public location. See `docs/ADMIN-SETUP.md` for the production rollout checklist.

## Production safety

This work is intentionally local-only until reviewed. Before any push or deployment, follow `AGENTS.md`, confirm the Esencia Git and Cloudflare identities, verify the existing Esencia D1 binding, configure Cloudflare Access, apply migrations, and run the guarded verification commands. Do not create R2 resources for this phase.
