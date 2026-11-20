import rss from '@astrojs/rss';
import collectionImageImports from 'astro:asset-imports';
import { getImage } from 'astro:assets';
import { getCollection } from 'astro:content';
import { RSS_URL, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../consts';
import { parseBlogPostId, sortBlogPosts } from '../lib/blog';
import { renderPostContent, renderPostDescription } from '../lib/rss-content';

export const prerender = true;

async function postImageUrls(post) {
  const urls = new Map();
  // astro:asset-imports and its import ID format are Astro internals. tests/build.test.mjs detects changes to either.
  const importQuery = new URLSearchParams({ astroContentImageFlag: '', importer: post.filePath });
  for (const source of post.rendered?.metadata?.imagePaths ?? []) {
    if (source.startsWith('/') || URL.canParse(source)) continue;
    const asset = collectionImageImports.get(`${source}?${importQuery}`);
    if (!asset) throw new Error(`Missing content image import for ${source}`);
    const image = await getImage({ src: asset });
    urls.set(source, image.src);
  }
  return urls;
}

export async function GET(context) {
  const site = context.site ?? SITE_URL;
  const posts = sortBlogPosts(await getCollection('blog'));

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    items: await Promise.all(
      posts.map(async (post) => {
        const link = `/blog/${post.id}/`;
        try {
          const postUrl = new URL(link, site);
          const imageUrls = await postImageUrls(post);
          return {
            title: post.data.title,
            pubDate: parseBlogPostId(post.id).date,
            description: renderPostDescription(post.data.description),
            link,
            content: renderPostContent(post.body, postUrl, imageUrls),
          };
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to render RSS content for ${post.id}: ${detail}`, { cause: error });
        }
      }),
    ),
    customData: `<language>en-us</language><atom:link href="${RSS_URL}" rel="self" type="application/rss+xml" />`,
  });
}
