// @ts-check
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { blogPostIdFromFilename, parseBlogPostId } from './src/lib/blog.ts';

const BLOG_DIR = './src/content/blog';

function loadBlogPostLastmods() {
  const lastmods = new Map();
  for (const file of readdirSync(BLOG_DIR)) {
    if (!file.endsWith('.md')) continue;
    const slug = blogPostIdFromFilename(file);
    const route = `/blog/${slug}/`;
    // Astro config runs before content collections, so updatedDate must be read here for sitemap metadata.
    const fm = readFileSync(join(BLOG_DIR, file), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const updated = fm?.[1].match(/^updatedDate:\s*['"]?([^'"\n]+?)['"]?\s*$/m)?.[1];
    const date = updated ?? parseBlogPostId(slug).date.toISOString();
    const parsed = new Date(date);
    if (Number.isNaN(parsed.valueOf())) {
      console.warn(`[sitemap] Skipping invalid frontmatter date in ${file}: ${date}`);
      continue;
    }
    lastmods.set(route, parsed.toISOString());
  }
  return lastmods;
}

const blogLastmods = loadBlogPostLastmods();

// https://astro.build/config
export default defineConfig({
  site: 'https://starhaven.io',
  trailingSlash: 'always',
  redirects: {
    '/blog/hello-starhaven': '/blog/2026-04-17-hello-starhaven/',
  },
  adapter: cloudflare({
    prerenderEnvironment: 'node',
    imageService: 'passthrough',
  }),
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = blogLastmods.get(new URL(item.url).pathname);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
