import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { projectIdentity } from './project-identity.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, '.env');

function parseDotEnv(contents) {
  const values = {};
  for (const rawLine of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

const local = existsSync(envPath) ? parseDotEnv(readFileSync(envPath, 'utf8')) : {};
const accountId = local.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = local.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

if (accountId !== projectIdentity.cloudflareAccountId) {
  console.error(`Esencia Cloudflare account mismatch. Expected ${projectIdentity.cloudflareAccountId}; run npm run cf:auth.`);
  process.exit(1);
}
if (!apiToken) {
  console.error('Esencia Cloudflare API token is missing. Run npm run cf:auth; never paste it into chat or commit it.');
  process.exit(1);
}

const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!existsSync(wrangler)) {
  console.error('Local Wrangler is missing. Run npm install from the Esencia repository root.');
  process.exit(1);
}
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Specify a Wrangler command, for example: node scripts/wrangler-project.mjs whoami');
  process.exit(1);
}

const result = spawnSync(process.execPath, [wrangler, ...args], {
  cwd: root,
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: projectIdentity.cloudflareAccountId, CLOUDFLARE_API_TOKEN: apiToken },
  stdio: 'inherit'
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
