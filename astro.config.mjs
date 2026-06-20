// @ts-check
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

const BLOG_DIR = './src/content/blog';

function loadBlogPostLastmods() {
  const lastmods = new Map();
  for (const file of readdirSync(BLOG_DIR)) {
    if (!/\.(md|mdx)$/.test(file)) continue;
    const slug = file.replace(/\.(md|mdx)$/, '');
    const fm = readFileSync(join(BLOG_DIR, file), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const pub = fm[1].match(/^pubDate:\s*['"]?([^'"\n]+?)['"]?\s*$/m)?.[1];
    const updated = fm[1].match(/^updatedDate:\s*['"]?([^'"\n]+?)['"]?\s*$/m)?.[1];
    const date = updated ?? pub;
    if (date) lastmods.set(`/blog/${slug}/`, new Date(date).toISOString());
  }
  return lastmods;
}

const blogLastmods = loadBlogPostLastmods();

// https://astro.build/config
export default defineConfig({
  site: 'https://starhaven.io',
  trailingSlash: 'always',
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
