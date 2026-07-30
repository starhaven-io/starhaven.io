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
  denies its current dependency install scripts and requires exact-version
  approvals for any exception.
- Run `just npm-policy` after dependency changes.
- Use `npm run dev` for local development.
- Use `npm run build` to build the Astro site.
- Use `npm run check` to type-check Astro and TypeScript sources.
- Use `npm test` to run the unit tests and `npm run test:smoke` for
  post-build assertions on `dist/client`.
- Use `npm run deploy:dry` to verify Wrangler deployment output without
  publishing.
- Use `npm run format:check` to check formatting and `npm run format` to apply
  Prettier.
- Use `just vale` to check prose in `README.md` and `src/content/blog/`.
- Use `just check` before handing off changes. If `typos`, Vale, or `zizmor` is
  not installed, note the skipped local checks.
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
- `public/`: Static assets, including the favicons and the default Open Graph
  image (`og.png`, 1200x630).
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
   expansion unless it is sanitized and covered by build-time checks. RSS uses
   a separate `markdown-it` and `sanitize-html` pipeline in
   `src/lib/rss-content.ts`; `tests/rss-content.test.mjs` pins its output so
   renderer divergence is reviewed explicitly. Footnotes fail the build until
   the feed renderer supports equivalent output.
6. Keep dependency changes conservative. Prefer existing Astro, Cloudflare, and
   npm tooling over adding new frameworks or build layers.
7. Do not edit generated build output under `dist/`.
8. Keep comments sparse and useful. Prefer clear names and straightforward
   structure over explanatory comments.
9. Update `README.md` when setup, verification, deployment, or project behavior
   changes.

<!-- fleet:block commit-and-pr-conventions -->

## Commit and PR conventions

- Conventional Commits: `type(scope): description`. Valid types: `feat`,
  `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- Commits require DCO sign-off. Make all commits with `git commit -s` (enforced
  by the `.githooks/commit-msg` hook; run `just install-hooks` once per clone).
- Do not identify an AI tool or model as an author, co-author, committer, or
  signatory of a commit. Do not name an AI tool or model in `Co-authored-by`,
  `Assisted-by`, `Co-developed-by`, `Generated-by`, or similar trailers. Human
  `Co-authored-by` trailers are allowed.
- Never commit directly to `main`; create a feature branch and open a PR.
- PR descriptions should contain a concise summary of changes and any required
  AI/LLM disclosure. Do not add a standalone test-plan section.
- When AI/LLM was used to generate or assist with a pull request, disclose the
  tool and model in the initial PR description, briefly describe its role, and
  state how the output was reviewed or verified.
- Keep AI/LLM disclosure factual and concise. Do not add promotional
  "generated with" footers.
- Keep each prose paragraph in a PR description on one source line. Do not
  hard-wrap PR body prose like a commit message; preserve intentional Markdown
  line breaks in lists, code blocks, and other structured content.
- Comments must earn their keep: a comment states a constraint or rationale the
  code cannot express. Never add comments that narrate what the code does,
  restate names, or explain a change to its reviewer.

<!-- fleet:end -->
