import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectIdentity as expected } from './project-identity.mjs';

const deployMode = process.argv.includes('--deploy');
const pushMode = process.argv.includes('--push');
const productionMode = deployMode || pushMode;
const failures = [];
const root = realpathSync(process.cwd());

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: false, env: process.env });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}
function sshIdentity(alias) {
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-T', `git@${alias}`], { cwd: root, encoding: 'utf8', shell: false });
  return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}
function check(condition, message) {
  if (!condition) failures.push(message);
}

check(root.toLowerCase() === expected.root.toLowerCase(), `local folder must be ${expected.root}`);
check(realpathSync(run('git', ['rev-parse', '--show-toplevel'])).toLowerCase() === root.toLowerCase(), 'current folder must be the Esencia Git repository root');
check(run('git', ['remote', 'get-url', 'origin']) === expected.gitRemote, `origin must be ${expected.gitRemote}`);
check(run('git', ['branch', '--show-current']) === expected.branch, `branch must be ${expected.branch}`);
check(run('git', ['config', '--local', 'user.name']) === expected.gitUserName, `repository Git user.name must be ${expected.gitUserName}`);
check(run('git', ['config', '--local', 'user.email']).toLowerCase() === expected.gitUserEmail.toLowerCase(), `repository Git user.email must be ${expected.gitUserEmail}`);

const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'));
check(config.account_id === expected.cloudflareAccountId, 'Cloudflare account ID does not match Esencia');
check(config.name === expected.worker, `Worker must be ${expected.worker}`);
check(config.main === expected.workerMain, `Worker entrypoint must be ${expected.workerMain}`);
const d1 = (config.d1_databases || []).find((item) => item.binding === expected.d1.binding);
check(d1?.database_name === expected.d1.name && d1?.database_id === expected.d1.id, 'Esencia D1 binding, database name, or ID does not match');
check(!config.kv_namespaces?.length, 'unexpected KV binding found');
check(!config.r2_buckets?.length, 'unexpected R2 binding found');
check(readFileSync(join(root, 'site.config.mjs'), 'utf8').includes(`url: "https://${expected.domain}"`), `production hostname must be ${expected.domain}`);
check(!/(ptgactivewear|chispiwebs)/.test(JSON.stringify(config).toLowerCase()), 'configuration contains another project identity');
check(run('git', ['check-ignore', '.env']) === '.env', '.env must remain ignored by Git');
check(spawnSync('git', ['ls-files', '--error-unmatch', '.env'], { cwd: root, stdio: 'ignore' }).status !== 0, '.env must never be tracked by Git');

if (productionMode) {
  check(run('git', ['status', '--porcelain']) === '', 'production release requires a clean Git worktree');
  const localHead = run('git', ['rev-parse', 'HEAD']);
  const remoteHead = run('git', ['ls-remote', 'origin', `refs/heads/${expected.branch}`]).split(/\s+/)[0];
  if (deployMode) check(localHead === remoteHead, 'local HEAD must exactly match origin/main before a manual deployment');
  if (pushMode) {
    const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', remoteHead, localHead], { cwd: root, stdio: 'ignore' });
    check(Boolean(remoteHead), 'origin/main could not be resolved');
    check(localHead !== remoteHead, 'there is no new local commit to push');
    check(ancestry.status === 0, 'local main must contain origin/main without divergence before a production push');
  }
  const github = sshIdentity(expected.sshAlias);
  check(github.status === 1 && github.output.includes(`Hi ${expected.githubAccount}!`) && github.output.includes('successfully authenticated'), `SSH identity must authenticate as ${expected.githubAccount}`);
  check(existsSync(join(root, '.env')), 'project-local .env authentication is missing; run npm run cf:auth');
  const identity = run(process.execPath, [join(root, 'scripts', 'wrangler-project.mjs'), 'whoami']);
  check(identity.includes(expected.cloudflareAccountId), 'authenticated Cloudflare account ID does not match Esencia');
  const deployments = run(process.execPath, [join(root, 'scripts', 'wrangler-project.mjs'), 'deployments', 'list', '--name', expected.worker]);
  check(deployments.includes('Created:'), `Cloudflare Worker ${expected.worker} was not found`);
  const d1List = run(process.execPath, [join(root, 'scripts', 'wrangler-project.mjs'), 'd1', 'list']);
  check(d1List.includes(expected.d1.id) && d1List.includes(expected.d1.name), 'production D1 database was not found in the Esencia account');
  try {
    const response = await fetch(`https://${expected.domain}`, { method: 'HEAD', redirect: 'follow' });
    check(response.ok && new URL(response.url).hostname === expected.domain, `${expected.domain} is not serving the canonical Esencia production site`);
  } catch {
    check(false, `${expected.domain} could not be reached`);
  }
}

if (failures.length) {
  console.error('ESENCIA PROJECT VERIFICATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Esencia identity verified: ${expected.gitRemote} · ${expected.branch} · ${expected.worker} · https://${expected.domain}`);
  if (productionMode) console.log(`Cloudflare account verified: ${expected.cloudflareAccountEmail} · ${expected.cloudflareAccountId}`);
}
