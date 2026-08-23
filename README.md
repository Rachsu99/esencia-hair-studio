# Esencia Hair Studio

Production website and private content dashboard for Esencia Hair Studio.

- Production: `https://esenciahair.co.nz`
- Repository: `Rachsu99/esencia-hair-studio`
- Runtime: Cloudflare Worker with Static Assets and D1
- Build output: `dist`
- Production branch: `main`

This repository is only for Esencia Hair Studio. Do not reuse its bindings,
secrets, database or deployment settings in PTG Activewear or another project.

## Architecture

`scripts/build.mjs` creates the public HTML pages in the project root and in
`dist`. Cloudflare publishes only `dist`. `worker/index.ts` serves those assets,
applies approved D1 content to public HTML, hides disabled services, generates
the sitemap and protects `/admin` plus `/api/admin/*`.

The admin password is never stored in the repository or browser JavaScript.
Only a PBKDF2-SHA256 password hash is configured as a Cloudflare secret. Admin
sessions use random HttpOnly, Secure, SameSite=Strict cookies, expiring D1
records, rotating CSRF tokens, same-origin checks and login throttling.

## Local development

Use Node.js 22 or newer.

```text
npm clean-install
npm run build
npm run dev
```

`npm run dev` starts the complete Worker locally, including the private admin
route and a local D1 database. `npm run dev:static` is available when only the
generated public files need a quick preview.

Before testing admin login locally, create `.dev.vars` (ignored by Git) from
the names in `.env.example`. Create a password hash without showing the
password on screen:

```text
npm run admin:hash
```

Set these three local values:

```text
ADMIN_USERNAME=your-private-username
ADMIN_PASSWORD_HASH=the-complete-pbkdf2-value
SESSION_SECRET=a-long-random-secret
```

Never put real values in `.env.example`, `wrangler.jsonc`, source files, commit
messages or screenshots.

## Checks

```text
npm run lint
npm test
npx wrangler deploy --dry-run
```

The tests rebuild the site, typecheck the Worker against generated Cloudflare
types, verify links and assets, confirm the enquiry flow remains frontend-only,
and check that admin routes and credential names do not leak into public HTML.

## Website content

Confirmed defaults are in `site.config.mjs`. General enquiries use
`Hello@esenciahair.co.nz`, appointment enquiries use
`Bookings@esenciahair.co.nz`, and the official Instagram account is
`@hairbyrachel.nz`. The public enquiry form prepares a message to the bookings
address in the visitor’s email application; it does not submit customer data to
this Worker.

At runtime, approved service copy, prices, visibility, existing gallery items,
contact details and homepage SEO can be edited at `/admin`. Keratin is publicly
available. Nanoplasty remains hidden and is excluded from public navigation,
content, direct routes and the generated sitemap.

The optional phone, address, hours and external booking link remain blank until
real business details are approved. Existing gallery images can be edited or
hidden; uploads require a separate, deliberately scoped R2 phase.

## Cloudflare production setup

Use the Esencia Cloudflare account only. The current local shell may be signed
into a different Cloudflare account; verify the account ID before every remote
command. Do not create an Esencia database or Worker in another account.

The Git-connected production build uses:

```text
Repository: Rachsu99/esencia-hair-studio
Production branch: main
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: repository root
Assets directory: dist (from wrangler.jsonc)
```

The D1 binding is declared as `ADMIN_DB`. Current Wrangler versions can
provision the production D1 resource during a Git deployment when the binding
does not yet have an ID. After the resource exists, preserve its generated ID
and never point this project at another site’s database.

Create these encrypted Worker secrets in the correct Esencia account before
the first admin-enabled deployment:

```text
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
SESSION_SECRET
```

The account token used by Cloudflare Builds must be allowed to deploy this
Worker and provision/use its D1 database. Git-connected builds use their own
Cloudflare account token; a local Wrangler login does not replace it.

Every push to `main` can trigger production. Review `git diff`, run all checks,
and confirm the active Cloudflare account before pushing.
