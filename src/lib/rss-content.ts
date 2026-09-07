import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { isPlainTextMetadata } from './blog.ts';

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

function safeLink(attribs: Attributes, base: string | URL): Attributes {
  const value = attribs.href;
  if (!value) return attribs;

  try {
    const destination = new URL(value, base);
    if (
      (destination.protocol === 'https:' || destination.protocol === 'mailto:') &&
      !destination.username &&
      !destination.password
    ) {
      return { ...attribs, href: destination.toString() };
    }
  } catch {
    // The link remains as text after its unsafe href is removed.
  }

  const { href: _href, ...safeAttributes } = attribs;
  return safeAttributes;
}

function sameOriginImage(attribs: Attributes, base: string | URL): Attributes {
  const value = attribs.src;
  if (!value) return attribs;

  try {
    const baseUrl = new URL(base);
    const source = new URL(value, baseUrl);
    if (source.protocol === 'https:' && source.origin === baseUrl.origin && !source.username && !source.password) {
      return { ...attribs, src: source.toString() };
    }
  } catch {
    // The missing src causes the image to be removed by exclusiveFilter.
  }

  const { src: _source, ...safeAttributes } = attribs;
  return safeAttributes;
}

export function renderPostDescription(description: string): string {
  if (!isPlainTextMetadata(description)) {
    throw new Error('RSS descriptions must be plain text without markup or control characters');
  }
  return description;
}

export function renderPostContent(body: string | undefined, base: string | URL): string {
  assertSupportedFeedMarkdown(body, base.toString());
  const rendered = parser.render(body ?? '');

  return sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedSchemes: ['https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: safeLink(attribs, base),
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: sameOriginImage(attribs, base),
      }),
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}
