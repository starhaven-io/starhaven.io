import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  deploySite,
  parseRemoteMain,
  validateBuiltRevision,
  validateDeployContext,
  validateRemoteMain,
} from '../scripts/deploy-site.mjs';
import { verifyDeployment } from '../scripts/verify-deployment.mjs';

const REVISION = 'a'.repeat(40);
const OTHER_REVISION = 'b'.repeat(40);

function validContext() {
  return {
    env: {
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REF_PROTECTED: 'true',
      GITHUB_REPOSITORY: 'starhaven-io/starhaven.io',
      GITHUB_SHA: REVISION,
      GITHUB_WORKFLOW_REF: 'starhaven-io/starhaven.io/.github/workflows/ci.yml@refs/heads/main',
      GITHUB_WORKFLOW_SHA: REVISION,
    },
    headSha: REVISION,
    worktreeStatus: '',
  };
}

function revisionResponse(revision, cacheControl = 'no-store, no-transform') {
  return new Response(JSON.stringify({ revision }), {
    headers: { 'cache-control': cacheControl, 'content-type': 'application/json' },
  });
}

describe('deployment guard', () => {
  it('accepts only the clean protected-main CI context for the checked-out SHA', () => {
    assert.doesNotThrow(() => validateDeployContext(validContext()));

    const mutations = [
      ['GITHUB_ACTIONS', 'false', /restricted to GitHub Actions/],
      ['GITHUB_EVENT_NAME', 'workflow_dispatch', /requires a push event/],
      ['GITHUB_REF', 'refs/heads/topic', /requires refs\/heads\/main/],
      ['GITHUB_REF_PROTECTED', 'false', /requires a protected main branch/],
      ['GITHUB_REPOSITORY', 'someone/starhaven.io', /requires starhaven-io\/starhaven\.io/],
      ['GITHUB_SHA', OTHER_REVISION, /checked-out commit must equal/],
      ['GITHUB_WORKFLOW_SHA', OTHER_REVISION, /workflow revision must equal/],
      [
        'GITHUB_WORKFLOW_REF',
        'starhaven-io/starhaven.io/.github/workflows/other.yml@refs/heads/main',
        /must run from ci\.yml/,
      ],
    ];
    for (const [key, value, message] of mutations) {
      const context = validContext();
      context.env[key] = value;
      assert.throws(() => validateDeployContext(context), message, key);
    }

    const dirty = validContext();
    dirty.worktreeStatus = ' M tracked-file';
    assert.throws(() => validateDeployContext(dirty), /worktree must be clean/);
  });

  it('binds the generated revision receipt to the event commit', () => {
    assert.doesNotThrow(() => validateBuiltRevision({ revision: REVISION }, REVISION));
    assert.throws(() => validateBuiltRevision({ revision: OTHER_REVISION }, REVISION), /exactly GITHUB_SHA/);
    assert.throws(() => validateBuiltRevision({ revision: REVISION, extra: true }, REVISION), /exactly GITHUB_SHA/);
    assert.throws(() => validateBuiltRevision(null, REVISION), /must be an object/);
  });

  it('allows only the current canonical remote main revision', () => {
    assert.equal(parseRemoteMain(`${REVISION}\trefs/heads/main\n`), REVISION);
    assert.doesNotThrow(() => validateRemoteMain(REVISION, REVISION));
    assert.throws(() => validateRemoteMain(OTHER_REVISION, REVISION), /refusing a stale deployment/);
    assert.throws(() => parseRemoteMain(''), /exactly one full lowercase commit SHA/);
    assert.throws(
      () => parseRemoteMain(`${REVISION}\trefs/heads/main\n${OTHER_REVISION}\trefs/heads/other`),
      /exactly one full lowercase commit SHA/,
    );
  });
});

describe('deployment', () => {
  function attemptDeploy({
    receipt = { revision: REVISION },
    remote = REVISION,
    status = '',
    wranglerStatus = 0,
  } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'starhaven-deploy-'));
    const argsFile = join(root, 'wrangler-args');
    try {
      mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
      mkdirSync(join(root, 'dist', 'client', '.well-known'), { recursive: true });
      writeFileSync(
        join(root, 'node_modules', '.bin', 'wrangler'),
        `#!/bin/sh\nprintf '%s\\n' "$@" > '${argsFile}'\nexit ${wranglerStatus}\n`,
        { mode: 0o755 },
      );
      writeFileSync(join(root, 'dist', 'client', 'wrangler.json'), '{}');
      if (receipt !== null) {
        writeFileSync(join(root, 'dist', 'client', '.well-known', 'revision.json'), JSON.stringify(receipt));
      }
      const git = (_repoRoot, command) =>
        ({ 'rev-parse': REVISION, status, 'ls-remote': `${remote}\trefs/heads/main` })[command];

      let error;
      try {
        deploySite({ env: validContext().env, repoRoot: root, git });
      } catch (caught) {
        error = caught;
      }
      const wranglerArgs = existsSync(argsFile) ? readFileSync(argsFile, 'utf8').trim().split('\n') : null;
      return { error, wranglerArgs, config: join(root, 'dist', 'client', 'wrangler.json') };
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('runs Wrangler with the built configuration for the verified revision', () => {
    const { error, wranglerArgs, config } = attemptDeploy();
    assert.equal(error, undefined);
    assert.deepEqual(wranglerArgs, ['deploy', '--config', config]);
  });

  it('never starts Wrangler for an unverified revision', () => {
    for (const [name, attempt, message] of [
      ['mismatched receipt', { receipt: { revision: OTHER_REVISION } }, /exactly GITHUB_SHA/],
      ['missing receipt', { receipt: null }, /receipt is missing/],
      ['moved remote main', { remote: OTHER_REVISION }, /refusing a stale deployment/],
      ['dirty worktree', { status: ' M tracked-file' }, /worktree must be clean/],
    ]) {
      const { error, wranglerArgs } = attemptDeploy(attempt);
      assert.match(error?.message ?? '', message, name);
      assert.equal(wranglerArgs, null, `${name}: Wrangler must not start`);
    }
  });

  it('fails when Wrangler fails', () => {
    assert.match(attemptDeploy({ wranglerStatus: 1 }).error?.message ?? '', /wrangler exited with status 1/);
  });
});

describe('deployment revision verification', () => {
  it('retries a stale public revision and verifies the expected one without caching', async () => {
    const requests = [];
    let sleeps = 0;
    const actual = await verifyDeployment('https://starhaven.io/.well-known/revision.json', REVISION, {
      attempts: 2,
      delayMs: 0,
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return revisionResponse(requests.length === 1 ? OTHER_REVISION : REVISION);
      },
      sleep: async () => {
        sleeps += 1;
      },
    });

    assert.equal(actual, REVISION);
    assert.equal(sleeps, 1);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.cache, 'no-store');
    assert.equal(requests[0].options.redirect, 'error');
    assert.ok(requests[0].options.signal instanceof AbortSignal);
    assert.equal(requests[0].url.searchParams.get('revision'), REVISION);
  });

  it('fails closed on cacheable, malformed, or insecure revision responses', async () => {
    await assert.rejects(
      () =>
        verifyDeployment('https://starhaven.io/.well-known/revision.json', REVISION, {
          attempts: 1,
          fetchImpl: async () => revisionResponse(REVISION, 'max-age=60'),
        }),
      (error) => error.cause?.message === 'revision endpoint is cacheable',
    );
    await assert.rejects(
      () =>
        verifyDeployment('https://starhaven.io/.well-known/revision.json', REVISION, {
          attempts: 1,
          fetchImpl: async () =>
            new Response(JSON.stringify({ revision: REVISION, extra: true }), {
              headers: { 'cache-control': 'no-store' },
            }),
        }),
      (error) => /exactly one full lowercase commit SHA/.test(error.cause?.message ?? ''),
    );
    await assert.rejects(() => verifyDeployment('http://starhaven.io/revision.json', REVISION), /must be an HTTPS URL/);
    await assert.rejects(
      () => verifyDeployment('https://starhaven.io/revision.json', REVISION, { timeoutMs: 0 }),
      /timeoutMs must be a positive integer/,
    );
  });
});
