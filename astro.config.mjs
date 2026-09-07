// @ts-check
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { blogPostIdFromFilename, blogPostLastmodFromSource, formatBlogDate } from './src/lib/blog.ts';
import { blogMarkdownPolicyPlugin } from './src/lib/markdown.ts';

const BLOG_DIR = './src/content/blog';

function loadBlogPostLastmods() {
  const lastmods = new Map();
  for (const file of readdirSync(BLOG_DIR)) {
    if (!file.endsWith('.md')) continue;
    const slug = blogPostIdFromFilename(file);
    const route = `/blog/${slug}/`;
    const source = readFileSync(join(BLOG_DIR, file), 'utf8');
    lastmods.set(route, formatBlogDate(blogPostLastmodFromSource(file, source)));
  }
  return lastmods;
}

const blogLastmods = loadBlogPostLastmods();

// https://astro.build/config
export default defineConfig({
  site: 'https://starhaven.io',
  session: false,
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
    processor: satteri({ mdastPlugins: [blogMarkdownPolicyPlugin] }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
