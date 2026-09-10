import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const jobs = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')).jobs;
const step = (job, name) => jobs[job].steps.find((candidate) => candidate.name === name);

function fixture(run) {
  const path = mkdtempSync(join(tmpdir(), 'starhaven downloads '));
  const env = {
    ...process.env,
    PATH: `${path}:${process.env.PATH}`,
    RUNNER_TEMP: path,
    GITHUB_PATH: join(path, 'path'),
    GITHUB_STEP_SUMMARY: join(path, 'summary'),
  };
  try {
    if (process.platform === 'darwin') {
      // macOS sha256sum lacks GNU's long options; shasum implements the same verification.
      writeFileSync(join(path, 'sha256sum'), '#!/bin/sh\nexec shasum -a 256 "$@"\n', { mode: 0o755 });
    }
    run(path, env);
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
}

const shell = (script, env) => spawnSync('bash', ['-euo', 'pipefail', '-c', script], { env, encoding: 'utf8' });

describe('CI tool downloads', () => {
  for (const [job, name, digest] of [
    ['lint', 'Install Vale', 'VALE_SHA256'],
    ['build', 'Install lychee', 'LYCHEE_SHA256'],
  ]) {
    it(`${name} checks downloaded bytes before extraction and propagates transport failure`, () => {
      const install = step(job, name);
      assert.match(install.env[digest], /^[a-f0-9]{64}$/);
      assert.match(
        install.run,
        /https:\/\/github\.com\/[^\s"$]+\/releases\/download\/(?:lychee-)?v\d+\.\d+\.\d+\/[^\s"$]+/,
      );
      for (const [body, transport, passes] of [
        ['reviewed bytes', '0', true],
        ['changed bytes', '0', false],
        ['reviewed bytes', '22', false],
      ]) {
        fixture((path, env) => {
          writeFileSync(join(path, 'payload'), body);
          writeFileSync(
            join(path, 'curl'),
            `#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = --output ]; then shift; output="$1"; fi\n  shift\ndone\ncp "$RUNNER_TEMP/payload" "$output"\nexit "$TRANSPORT_STATUS"\n`,
            { mode: 0o755 },
          );
          writeFileSync(join(path, 'tar'), '#!/bin/sh\ntouch "$RUNNER_TEMP/extracted"\n', { mode: 0o755 });
          const result = shell(install.run, {
            ...env,
            [digest]: createHash('sha256').update('reviewed bytes').digest('hex'),
            TRANSPORT_STATUS: transport,
          });
          assert.equal(result.status === 0, passes, result.stderr);
          assert.equal(existsSync(join(path, 'extracted')), passes);
          assert.equal(existsSync(env.GITHUB_PATH), passes);
          if (passes) assert.equal(readFileSync(env.GITHUB_PATH, 'utf8'), `${path}\n`);
          if (transport !== '0') assert.equal(result.status, Number(transport));
        });
      }
    });
  }

  it('checks the same offline inputs, publishes the summary, and rejects failed or empty scans', () => {
    const check = step('build', 'Check internal links').run;
    for (const [count, status, expected] of [
      [5, 0, 0],
      [5, 2, 2],
      [0, 0, 1],
    ]) {
      fixture((path, env) => {
        writeFileSync(
          join(path, 'lychee'),
          `#!/bin/sh\nprintf '%s\\n' "$@" > "$RUNNER_TEMP/args"\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = --output ]; then shift; output="$1"; fi\n  shift\ndone\nprintf '| Total | %s |\\n' "$LINK_COUNT" > "$output"\nexit "$LINK_STATUS"\n`,
          { mode: 0o755 },
        );
        const result = shell(check, { ...env, LINK_COUNT: String(count), LINK_STATUS: String(status) });
        assert.equal(result.status, expected, result.stderr);
        assert.equal(readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8'), `| Total | ${count} |\n`);
        const args = readFileSync(join(path, 'args'), 'utf8').split('\n');
        for (const arg of [
          '--offline',
          '--config',
          'lychee.toml',
          '--root-dir',
          'dist/client',
          'dist/client/**/*.html',
          'README.md',
        ])
          assert.ok(args.includes(arg), arg);
      });
    }
  });
});
