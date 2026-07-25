import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

// Full-content RSS needs sanitized, self-contained HTML with absolute URLs, so
// this intentionally differs from Astro's remark and Shiki rendering pipeline.
const parser = new MarkdownIt();

type Attributes = Record<string, string>;

function hasFootnoteDefinition(body: string): boolean {
  const fencedLines = new Set<number>();
  for (const token of parser.parse(body, {})) {
    if (token.type !== 'fence' || !token.map) continue;
    for (let line = token.map[0]; line < token.map[1]; line += 1) {
      fencedLines.add(line);
    }
  }
  return body.split(/\r?\n/).some((line, index) => !fencedLines.has(index) && /^ {0,3}\[\^[^\]\r\n]+\]:/.test(line));
}

export function assertSupportedFeedMarkdown(body: string | undefined, label: string): void {
  if (hasFootnoteDefinition(body ?? '')) {
    throw new Error(`RSS rendering does not support footnotes in ${label}; replace them with ordinary links`);
  }
}

function absolutizeAttribute(attribs: Attributes, attribute: string, base: string | URL): Attributes {
  const value = attribs[attribute];
  if (!value) return attribs;

  try {
    return { ...attribs, [attribute]: new URL(value, base).toString() };
  } catch {
    return attribs;
  }
}

export function renderPostContent(body: string | undefined, base: string | URL): string {
  assertSupportedFeedMarkdown(body, base.toString());
  const rendered = parser.render(body ?? '');

  return sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: absolutizeAttribute(attribs, 'href', base),
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: absolutizeAttribute(attribs, 'src', base),
      }),
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}
