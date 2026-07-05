# Agent Instructions for starhaven.io

Run `just check` before committing or opening a PR. It is the closest local match
to CI and covers typo checks, GitHub Actions auditing, formatting, Astro type
checking, the Astro build, and Wrangler dry-run deploy validation when the
required tools are installed.

## Project overview

This is an Astro 7 site deployed to Cloudflare Workers. It is the landing page
for the starhaven.io organization and its projects, plus a blog. Keep changes
small, readable, and consistent with the existing hand-written CSS and content
model.

## Required checks

- Use `npm ci --strict-allow-scripts` for clean dependency installs. The repo
  uses npm's reviewed install-script allowlist in `package.json`.
- Use `npm run dev` for local development.
- Use `npm run build` to build the Astro site.
- Use `npm run check` to type-check Astro and TypeScript sources.
- Use `npm run deploy:dry` to verify Wrangler deployment output without
  publishing.
- Use `npm run format:check` to check formatting and `npm run format` to apply
  Prettier.
- Use `just check` before handing off changes. If `typos` or `zizmor` is not
  installed, note the skipped local checks.
- Run `just install-hooks` once per clone to enable the DCO commit-msg hook and
  the pre-push `just check` hook.

## Repository structure

- `astro.config.mjs`: Astro, Cloudflare, sitemap, and Markdown configuration.
- `src/content.config.ts`: Blog collection schema.
- `src/content/blog/`: Markdown blog posts.
- `src/layouts/Base.astro`: Shared HTML shell, meta tags, navigation, and
  footer.
- `src/pages/index.astro`: Landing page.
- `src/pages/blog/`: Blog listing and post routes.
- `src/pages/rss.xml.js`: RSS feed.
- `src/styles/global.css`: Theme tokens, resets, and shared styles.
- `public/`: Static assets, including favicon and Open Graph image.
- `wrangler.jsonc`: Cloudflare Workers configuration.
- `.github/workflows/`: CI, deploy, link checking, and pinprick audit workflows.

## Safety / do-not-touch rules

1. Prefer Astro's static/prerendered model unless a feature truly needs runtime
   Worker behavior.
2. Keep UI work aligned with the existing design: hand-written CSS, CSS custom
   properties, system-aware light/dark colors, and Apple system font stacks.
   Do not add `@fontsource/*` packages or remote font imports.
3. Keep generated assets in `public/` and avoid introducing client-side
   JavaScript unless the interaction requires it.
4. Preserve security headers, metadata, canonical URLs, RSS, and sitemap behavior
   when changing layout, routing, or Markdown handling.
5. Treat Markdown/blog rendering as a security-sensitive path. Avoid raw HTML
   expansion unless it is sanitized and covered by build-time checks.
6. Keep dependency changes conservative. Prefer existing Astro, Cloudflare, and
   npm tooling over adding new frameworks or build layers.
7. Do not edit generated build output under `dist/`.
8. Keep comments sparse and useful. Prefer clear names and straightforward
   structure over explanatory comments.
9. Update `README.md` when setup, verification, deployment, or project behavior
   changes.

## Commit and PR conventions

- Conventional Commits: `type(scope): description`. Valid types: `feat`,
  `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- Sign off every commit with `git commit -s` for DCO (enforced by the
  `.githooks/commit-msg` hook; run `just install-hooks` once per clone to
  enable it).
- When authored with an AI coding agent, add a `Co-Authored-By` trailer after
  `Signed-off-by`, naming the agent and model. Current example:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Bump the model
  version as newer ones ship.
- Never commit directly to `main`; create a feature branch and open a PR.
- PR descriptions should contain only a concise summary of changes. Do not add
  test-plan sections, bot attribution, or generated-with footers.
