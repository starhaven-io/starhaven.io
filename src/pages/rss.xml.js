import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { RSS_URL, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../consts';
import { parseBlogPostId, sortBlogPosts } from '../lib/blog';
import { renderPostContent } from '../lib/rss-content';

export const prerender = true;

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
    items: posts.map((post) => {
      const link = `/blog/${post.id}/`;
      try {
        return {
          title: post.data.title,
          pubDate: parseBlogPostId(post.id).date,
          description: post.data.description,
          link,
          content: renderPostContent(post.body, new URL(link, site)),
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to render RSS content for ${post.id}: ${detail}`, { cause: error });
      }
    }),
    customData: `<language>en-us</language><atom:link href="${RSS_URL}" rel="self" type="application/rss+xml" />`,
  });
}
