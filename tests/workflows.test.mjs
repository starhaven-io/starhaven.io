import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const sourceEditGuard =
  "if: github.event_name != 'pull_request' || github.event.action != 'edited' || github.event.changes.base.ref.from != ''";

function job(name, nextName) {
  const match = workflow.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)\\n  ${nextName}:\\n`));
  assert.ok(match, `missing ${name} job`);
  return match[1];
}

describe('CI workflow', () => {
  it('coalesces metadata-only edits without cancelling or rerunning source checks', () => {
    assert.doesNotMatch(workflow, /github\.run_id/);
    assert.match(workflow, /format\('ci-edit-\{0\}', github\.event\.pull_request\.number\)/);
    assert.match(workflow, /github\.event\.changes\.base\.ref\.from == ''/);
    for (const [name, next] of [
      ['lint', 'build'],
      ['build', 'zizmor'],
      ['zizmor', 'codeql'],
    ]) {
      assert.ok(job(name, next).includes(sourceEditGuard), `${name} lacks the source-edit guard`);
    }
    assert.match(
      job('codeql', 'source'),
      /github\.event\.action != 'edited' \|\| github\.event\.changes\.base\.ref\.from != ''/,
    );
    assert.match(job('source', 'conclusion'), new RegExp(`if: always\\(\\) && \\(${sourceEditGuard.slice(4)}\\)`));
  });

  it('emits the required conclusion in every run and mirrors the source gate for metadata edits', () => {
    const conclusion = job('conclusion', 'deploy');
    assert.match(conclusion, /^    name: conclusion$/m);
    assert.doesNotMatch(conclusion, /\$\{\{[^\n]*name/);
    assert.match(conclusion, /needs: \[commits, source\]/);
    assert.match(conclusion, /^    if: always\(\)$/m);
    assert.match(conclusion, /checks: read/);
    assert.match(conclusion, /HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    assert.match(conclusion, /check-runs\?check_name=source&per_page=100/);
    assert.match(conclusion, /select\(\.app\.slug == "github-actions" and \.conclusion != "skipped"/);
    assert.match(conclusion, /contains\("\/runs\/\\\(env\.GITHUB_RUN_ID\)\/"\) \| not/);
    assert.match(conclusion, /SOURCE_STATE}" != "success"/);
    assert.doesNotMatch(workflow, /'metadata'/);
  });

  it('deploys only after the exact main-push conclusion and verifies public identity', () => {
    const deploy = workflow.match(/\n  deploy:\n([\s\S]*)$/)?.[1] ?? '';
    assert.match(deploy, /needs: conclusion/);
    assert.match(deploy, /github\.event_name == 'push'/);
    assert.match(deploy, /github\.ref == 'refs\/heads\/main'/);
    assert.match(deploy, /needs\.conclusion\.result == 'success'/);
    assert.match(deploy, /node scripts\/verify-deployment\.mjs/);
    assert.equal(existsSync(new URL('../.github/workflows/deploy-site.yml', import.meta.url)), false);
  });
});
