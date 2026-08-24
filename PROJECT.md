# Esencia Hair Studio project identity

| Field | Production identity |
| --- | --- |
| Local folder | `C:\Users\Nico\Documents\Esencia Hair Studio` |
| GitHub account | `Rachsu99` |
| GitHub repository | `Rachsu99/esencia-hair-studio` |
| Git remote | `git@github-rachsu99:Rachsu99/esencia-hair-studio.git` |
| Production branch | `main` |
| Cloudflare account | `Rachsu99@gmail.com` (`9997b3a7d9f144f03c921aaef9c0d53d`) |
| Cloudflare Worker | `esencia-hair-studio` |
| Production domain | `https://esenciahair.co.nz` |
| D1 | `ADMIN_DB` / `esencia-hair-studio-admin` / `0b4598c2-932f-43bc-9865-34060a380660` |
| KV | Not enabled or required |
| R2 | Not enabled or required |
| Deployment mode | Cloudflare Git integration from `main`; guarded local Wrangler deployment is available as `npm run deploy` |

Esencia must never use another project's Cloudflare token, account ID, Worker, database, storage binding, Git repository, SSH identity, domain, or deployment configuration.

Run `npm run verify:project` before infrastructure work. After committing reviewed changes, run `npm run verify:push` before pushing `main`; run `npm run verify:deploy` before a direct production migration or manual deployment. Run `.\scripts\configure-cloudflare-auth.ps1` once to configure the ignored project-local token and `.\scripts\wrangler-project.ps1 whoami` to verify it without a global Wrangler installation.
