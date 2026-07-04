import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { RSS_URL, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../consts';

export const prerender = true;

const parser = new MarkdownIt();

function absolutizeAttribute(attribs, attribute, base) {
  const value = attribs[attribute];
  if (!value) return attribs;

  try {
    return { ...attribs, [attribute]: new URL(value, base).toString() };
  } catch {
    return attribs;
  }
}

function renderPostContent(body, site) {
  return sanitizeHtml(parser.render(body ?? ''), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: absolutizeAttribute(attribs, 'href', site),
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: absolutizeAttribute(attribs, 'src', site),
      }),
    },
  });
}

export async function GET(context) {
  const site = context.site ?? SITE_URL;
  const posts = (await getCollection('blog')).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.id}/`,
      content: renderPostContent(post.body, site),
    })),
    customData: `<language>en-us</language><atom:link href="${RSS_URL}" rel="self" type="application/rss+xml" />`,
  });
}
