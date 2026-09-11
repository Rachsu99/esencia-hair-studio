# Esencia price admin production setup

This repository contains the local Phase 1 implementation only. Do not deploy it until the admin page and price map have been reviewed.

## Existing production identity

- Worker: `esencia-hair-studio`
- Domain: `https://esenciahair.co.nz`
- D1 binding: `ADMIN_DB`
- D1 database: `esencia-hair-studio-admin`
- Migration directory: `migrations`
- Worker entry point: `worker/index.ts`
- Static output: `dist`

The Esencia-specific production D1 database already exists in `wrangler.jsonc`. Reuse it only after the `AGENTS.md` production safety gate passes. Do not create a duplicate and never substitute another project's database.

## Production rollout

1. Back up the existing Esencia D1 database and verify the account, database name, ID, binding, Worker, Git remote, branch, and hostname against `AGENTS.md`.
2. Review `migrations/0001_service_prices.sql`. Apply it to `ADMIN_DB` using the project-local Wrangler wrapper with the remote flag. Do not edit an already-applied migration; append a new migration for later changes.
3. Confirm all seeded amounts match `docs/PRICE-MAP.md` before deploying the Worker.
4. In Cloudflare Zero Trust, enable One-time PIN or the approved identity provider.
5. Create one self-hosted Access application for the Esencia admin surface, covering `esenciahair.co.nz/admin*` and `esenciahair.co.nz/api/admin/*`. Do not protect the public website.
6. Add an Allow policy restricted to the authorised client email. Deny all other identities.
7. Copy the Cloudflare Access team domain and the application's Audience (AUD) tag.
8. Configure Worker runtime values named `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. Do not commit their values to Git.
9. Run the complete build, tests, local price end-to-end test, and a Wrangler dry run.
10. Commit the reviewed files. Run the repository's guarded push verification before pushing `main`, or its guarded deploy verification before a manual deployment.
11. After deployment, confirm `/admin` triggers Cloudflare Access, the authorised client can sign in, prices load, a controlled price change is reflected in all linked public locations, and the audit row records the Access email.
12. Confirm unauthorised and cross-origin writes fail, stale revisions return `409`, static fallback prices remain visible during a simulated D1 failure, and `/cdn-cgi/access/logout` ends the Access session.
13. Confirm `/admin` is absent from navigation, sitemap, structured data, and public search indexing.

## Phase boundaries

Phase 1 manages numeric service prices only. Do not add description editing, service visibility controls, image uploads, gallery editing, or R2 resources. Phase 2 can add descriptions to separate tables and APIs. Phase 3 can add an Esencia-specific R2 bucket and image metadata without changing the price model.
