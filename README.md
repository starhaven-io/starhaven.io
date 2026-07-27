# starhaven.io

<!-- fleet:block badges -->

[![CI](https://github.com/starhaven-io/starhaven.io/actions/workflows/ci.yml/badge.svg)](https://github.com/starhaven-io/starhaven.io/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)
[![Prose: CC-BY-SA-4.0](https://img.shields.io/badge/Prose-CC--BY--SA--4.0-green.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

<!-- fleet:end -->

The website for [starhaven.io](https://starhaven.io).

## Development

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
assertions, and a Wrangler dry-run. Install the optional local tools with:

```bash
brew install just typos-cli vale zizmor lychee
```

Vale checks prose in `README.md` and `src/content/blog/`; the separate `just
lychee` recipe checks links in the built site.

## Blog posts

Blog posts live in `src/content/blog/` and use `YYYY-MM-DD-slug.md` filenames.
The filename supplies the publication date, determines chronological ordering,
and forms the date-prefixed post URL, so do not add a separate `pubDate`
frontmatter field.

## Deploy

Pushes to `main` deploy to Cloudflare Workers via the `deploy-site` workflow.

<!-- fleet:block license-section -->

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`).

Prose (blog posts and site copy) is licensed separately under [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Copyright (C) 2026 Patrick Linnane

<!-- fleet:end -->
