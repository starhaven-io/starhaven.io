# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Website for [starhaven.io](https://starhaven.io) — the landing page for the starhaven.io org and its projects (Brewy, macOSdb, pinprick), plus a blog.

- **Framework:** Astro 6
- **Deploy:** Cloudflare Workers (`@astrojs/cloudflare` + `wrangler`)
- **Styling:** hand-written CSS with CSS custom properties and system-aware light/dark
- **Fonts:** Apple system stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Text', …`) for sans; `ui-monospace, 'SF Mono', Menlo, …` for mono. No `@fontsource/*` imports.

## Structure

```
starhaven.io/
├── astro.config.mjs
├── src/
│   ├── content.config.ts        # Blog collection schema (glob loader, zod)
│   ├── content/blog/            # Drop markdown posts here
│   ├── layouts/Base.astro       # Shared HTML shell, meta tags, nav, footer
│   ├── pages/
│   │   ├── index.astro          # Landing page
│   │   └── blog/
│   │       ├── index.astro      # Post listing
│   │       └── [...slug].astro  # Post page
│   └── styles/global.css        # Theme tokens, resets, shared styles
├── public/                      # Static assets (favicon, og.png)
├── wrangler.jsonc
└── .github/workflows/deploy-site.yml
```

## Commit conventions

Conventional Commits format: `type(scope): description` (types: feat, fix, refactor, docs, ci, chore).

All commits must:

- Include a `Signed-off-by` trailer for DCO sign-off
- Include a `Co-authored-by: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer when authored with Claude, placed after `Signed-off-by`

## Git workflow

- Never commit directly to `main` — always create a feature branch and open a PR
- PR descriptions should contain only a summary of the changes — no test plan sections, no bot attribution, no "Generated with Claude Code" footers
