import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = 'starhaven-io/starhaven.io';
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/ci.yml@refs/heads/main`;
const REMOTE_MAIN = `https://github.com/${REPOSITORY}.git`;

export function validateDeployContext({ env, headSha, worktreeStatus }) {
  const requirements = [
    [env.GITHUB_ACTIONS === 'true', 'deployment is restricted to GitHub Actions'],
    [env.GITHUB_EVENT_NAME === 'push', 'deployment requires a push event'],
    [env.GITHUB_REF === 'refs/heads/main', 'deployment requires refs/heads/main'],
    [env.GITHUB_REF_PROTECTED === 'true', 'deployment requires a protected main branch'],
    [env.GITHUB_REPOSITORY === REPOSITORY, `deployment requires ${REPOSITORY}`],
    [SHA.test(env.GITHUB_SHA ?? ''), 'GITHUB_SHA must be a full lowercase commit SHA'],
    [env.GITHUB_SHA === headSha, 'the checked-out commit must equal GITHUB_SHA'],
    [env.GITHUB_WORKFLOW_SHA === env.GITHUB_SHA, 'the workflow revision must equal GITHUB_SHA'],
    [env.GITHUB_WORKFLOW_REF === WORKFLOW_REF, 'deployment must run from ci.yml on main'],
    [worktreeStatus === '', 'the tracked worktree must be clean'],
  ];

  const failed = requirements.find(([satisfied]) => !satisfied);
  if (failed) throw new Error(failed[1]);
}

export function validateBuiltRevision(payload, expectedRevision) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('built revision receipt must be an object');
  }
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'revision' || payload.revision !== expectedRevision) {
    throw new Error('built revision receipt must contain exactly GITHUB_SHA');
  }
}

export function parseRemoteMain(output) {
  const match = /^([0-9a-f]{40})[ \t]+refs\/heads\/main$/.exec(output.trim());
  if (!match) throw new Error('remote main did not resolve to exactly one full lowercase commit SHA');
  return match[1];
}

export function validateRemoteMain(remoteRevision, expectedRevision) {
  if (remoteRevision !== expectedRevision) {
    throw new Error(`remote main is ${remoteRevision}, expected ${expectedRevision}; refusing a stale deployment`);
  }
}

function git(repoRoot, ...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

export function deploySite({ env = process.env } = {}) {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  validateDeployContext({
    env,
    headSha: git(repoRoot, 'rev-parse', 'HEAD'),
    worktreeStatus: git(repoRoot, 'status', '--porcelain', '--untracked-files=all'),
  });

  const wrangler = path.join(repoRoot, 'node_modules', '.bin', 'wrangler');
  const config = path.join(repoRoot, 'dist', 'client', 'wrangler.json');
  const revisionReceipt = path.join(repoRoot, 'dist', 'client', '.well-known', 'revision.json');
  if (!existsSync(wrangler)) throw new Error('wrangler is not installed; run npm ci first');
  if (!existsSync(config)) throw new Error('deployment configuration is missing; run npm run build first');
  if (!existsSync(revisionReceipt)) throw new Error('built revision receipt is missing; run npm run build first');

  let revisionPayload;
  try {
    revisionPayload = JSON.parse(readFileSync(revisionReceipt, 'utf8'));
  } catch (error) {
    throw new Error('built revision receipt is not valid JSON', { cause: error });
  }
  validateBuiltRevision(revisionPayload, env.GITHUB_SHA);
  validateRemoteMain(
    parseRemoteMain(git(repoRoot, 'ls-remote', '--exit-code', REMOTE_MAIN, 'refs/heads/main')),
    env.GITHUB_SHA,
  );

  const result = spawnSync(wrangler, ['deploy', '--config', config], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`wrangler exited with status ${result.status ?? 'unknown'}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    deploySite();
  } catch (error) {
    console.error(`deploy: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
