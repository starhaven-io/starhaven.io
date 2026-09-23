import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const SITE_FILES = ['astro.config.mjs', 'package.json', 'public', 'src', 'tsconfig.json', 'wrangler.jsonc'];

// Astro and Vite cache under <root>/node_modules, so each copy links the installed
// packages from a directory of its own instead of sharing the repository's caches.
function siteWithPost(body) {
  const root = mkdtempSync(join(tmpdir(), 'starhaven-build-'));
  for (const file of SITE_FILES) cpSync(join(repo, file), join(root, file), { recursive: true });
  mkdirSync(join(root, 'node_modules'));
  for (const entry of readdirSync(join(repo, 'node_modules'))) {
    if (!entry.startsWith('.')) symlinkSync(join(repo, 'node_modules', entry), join(root, 'node_modules', entry));
  }
  writeFileSync(
    join(root, 'src', 'content', 'blog', '2026-01-01-fixture.md'),
    `---\ntitle: Fixture\ndescription: A build fixture.\n---\n\n${body}\n`,
  );
  return root;
}

function build(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
      cwd: root,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}

async function buildWithPost(body) {
  const root = siteWithPost(body);
  try {
    return await build(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('blog build', { concurrency: true, timeout: 180_000 }, () => {
  for (const [name, body, error] of [
    ['raw HTML', 'Hello <span>raw</span> world.', /Raw HTML is not allowed/],
    ['an HTTP link', 'See [the docs](http://example.com/docs).', /Markdown link URL is not allowed/],
    ['a footnote defined in a quote', 'A claim.[^1]\n\n> [^1]: The note.', /Footnotes are not allowed/],
    ['a footnote defined in a list', 'A claim.[^1]\n\n- [^1]: The note.', /Footnotes are not allowed/],
  ]) {
    it(`fails when a post contains ${name}`, async () => {
      const { status, output } = await buildWithPost(body);
      assert.notEqual(status, 0, output);
      assert.match(output, error);
      assert.match(output, /Blog post 2026-01-01-fixture failed to render/);
    });
  }

  it('builds a valid post with an empty body', async () => {
    const { status, output } = await buildWithPost('');
    assert.equal(status, 0, output);
  });
});
