# Esencia Hair Studio project instructions

## Production safety gate

Before any production migration or deployment, verify the local project directory, Git remote, Cloudflare project/account, D1 database ID, R2 bucket, and production hostname. Stop on any mismatch.

This repository must use GitHub account `Rachsu99` through SSH alias `github-rachsu99`, Cloudflare account `Rachsu99@gmail.com` (`9997b3a7d9f144f03c921aaef9c0d53d`), Worker `esencia-hair-studio`, D1 database `esencia-hair-studio-admin` (`0b4598c2-932f-43bc-9865-34060a380660`), and production hostname `esenciahair.co.nz` only.

For local Cloudflare CLI commands, use `.\scripts\wrangler-project.ps1 whoami` or `.\scripts\wrangler-project.ps1 <command>`. It loads the Git-ignored project-local `.env` and overrides unrelated inherited credentials for the child process only. Routine work must not depend on global `wrangler login`, `wrangler logout`, or a global Wrangler installation.

Before a push to `main` that triggers production, commit the reviewed changes and run `npm run verify:push`. Before every direct production migration or manual deployment, run `npm run verify:deploy`. Stop on any mismatch. Esencia currently has no R2 binding; the unexpected appearance of an R2 bucket, PTG binding, or ChispiWebs binding is a deployment blocker.
