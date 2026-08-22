# Esencia Hair Studio project instructions

## Production safety gate

Before any production migration or deployment, verify the local project directory, Git remote, Cloudflare project/account, D1 database ID, R2 bucket, and production hostname. Stop on any mismatch.

For local Cloudflare CLI commands in this project, ignore the inherited `CLOUDFLARE_API_TOKEN`; it belongs to a separate PTG account. Use the Wrangler OAuth login for `rachsu99@gmail.com` and verify Cloudflare account ID `9997b3a7d9f144f03c921aaef9c0d53d` before continuing.
