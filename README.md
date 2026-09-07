# starhaven.io

<!-- fleet:block badges -->

[![CI](https://github.com/starhaven-io/starhaven.io/actions/workflows/ci.yml/badge.svg)](https://github.com/starhaven-io/starhaven.io/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)
[![Prose: CC-BY-SA-4.0](https://img.shields.io/badge/Prose-CC--BY--SA--4.0-green.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

<!-- fleet:end -->

The website for [starhaven.io](https://starhaven.io).

## Development

Use a Node.js version satisfying `engines.node` in `package.json`. Install the
dependencies exactly as locked, then start Astro:

```bash
npm ci --strict-allow-scripts
npm run dev
```

The project explicitly denies its current dependency install scripts. `just
npm-policy` verifies the lockfile policy; clean installs fail on any unreviewed
script-bearing dependency.

Run `just install-hooks` once per clone to enable the git hooks (a pre-push `just check` and DCO sign-off enforcement).

For local verification, run `just check`. It runs typos, Vale, zizmor,
formatting, type checks, unit tests, a production build, post-build smoke
assertions, and a Wrangler dry-run. The full gate requires these local tools:

```bash
brew install just typos-cli vale zizmor
```

Vale checks prose in `README.md` and `src/content/blog/`. The optional `just
lychee` recipe checks links in the built site and requires `brew install
lychee`.

## Blog posts

Blog posts live in `src/content/blog/` and use `YYYY-MM-DD-slug.md` filenames.
The filename supplies the publication date, determines chronological ordering,
and forms the date-prefixed post URL, so do not add a separate `pubDate`
frontmatter field. An optional `updatedDate` YAML field in `YYYY-MM-DD` format
supplies sitemap and article metadata and cannot precede the filename date.

Titles and descriptions must be plain text. Raw HTML, non-HTTPS web links,
credentialed links, and off-site images in blog Markdown fail the build. RSS
descriptions are emitted as plain text, and RSS post bodies retain safe external
links but include images only when they use HTTPS on `starhaven.io`.

## Deploy

The `CI` workflow deploys a protected `main` push only after that exact commit
passes the post-merge gate. The deployment publishes a revision receipt at
`/.well-known/revision.json` and verifies the public response before reporting
success.

`npm run deploy` is guarded for that trusted GitHub Actions path and is not a
local publication command. Use `npm run deploy:dry` to validate generated
Wrangler output without publishing.

<!-- fleet:block license-section -->

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`).

Prose (blog posts and site copy) is licensed separately under [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Copyright (C) 2026 Patrick Linnane

<!-- fleet:end -->
