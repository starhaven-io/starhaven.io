import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

// Full-content RSS needs sanitized, self-contained HTML with absolute URLs, so
// this intentionally differs from Astro's remark and Shiki rendering pipeline.
const parser = new MarkdownIt();

type Attributes = Record<string, string>;

function absolutizeAttribute(attribs: Attributes, attribute: string, base: string | URL): Attributes {
  const value = attribs[attribute];
  if (!value) return attribs;

  try {
    return { ...attribs, [attribute]: new URL(value, base).toString() };
  } catch {
    return attribs;
  }
}

export function renderPostContent(body: string | undefined, site: string | URL): string {
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
