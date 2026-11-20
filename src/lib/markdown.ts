import { SITE_URL } from '../consts.ts';

const SITE_ORIGIN = new URL(SITE_URL).origin;

interface MarkdownNode {
  type: string;
  children?: readonly MarkdownNode[];
  identifier?: string;
  url?: string;
  position?: {
    start: {
      line: number;
      column: number;
    };
  };
}

interface MarkdownPluginContext {
  fileURL?: URL;
  data?: { astro?: { localImagePaths: Set<string> } };
}

function sourceLocation(node: MarkdownNode, context: MarkdownPluginContext): string {
  const source = context.fileURL ? decodeURIComponent(context.fileURL.pathname) : 'Markdown';
  const start = node.position?.start;
  return start ? `${source}:${start.line}:${start.column}` : source;
}

function walk(node: MarkdownNode, visit: (child: MarkdownNode) => void) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function validateUrl(value: string, kind: 'link' | 'image', node: MarkdownNode, context: MarkdownPluginContext) {
  let url: URL;
  try {
    url = new URL(value, SITE_URL);
  } catch {
    throw new Error(`Invalid Markdown ${kind} URL in ${sourceLocation(node, context)}`);
  }

  const credentialFree = !url.username && !url.password;
  const allowed =
    kind === 'link'
      ? credentialFree && (url.protocol === 'https:' || url.protocol === 'mailto:')
      : credentialFree && url.protocol === 'https:' && url.origin === SITE_ORIGIN;
  if (!allowed) {
    const requirement = kind === 'link' ? 'credential-free HTTPS or mailto' : 'credential-free same-origin HTTPS';
    throw new Error(`Markdown ${kind} URL is not allowed in ${sourceLocation(node, context)}; use ${requirement}`);
  }
}

function footnoteError(node: MarkdownNode, context: MarkdownPluginContext): Error {
  return new Error(
    `Footnotes are not allowed in ${sourceLocation(node, context)}; the RSS feed cannot render them, so use ordinary links instead`,
  );
}

export const blogMarkdownPolicyPlugin = {
  name: 'blog-markdown-policy',
  options: { position: true },
  html(node: MarkdownNode, context: MarkdownPluginContext): never {
    throw new Error(`Raw HTML is not allowed in ${sourceLocation(node, context)}; use Markdown syntax instead`);
  },
  footnoteDefinition(node: MarkdownNode, context: MarkdownPluginContext): never {
    throw footnoteError(node, context);
  },
  footnoteReference(node: MarkdownNode, context: MarkdownPluginContext): never {
    throw footnoteError(node, context);
  },
  after(root: MarkdownNode, context: MarkdownPluginContext) {
    const definitions = new Map<string, string>();
    walk(root, (node) => {
      if (
        node.type === 'definition' &&
        node.identifier &&
        node.url !== undefined &&
        !definitions.has(node.identifier)
      ) {
        definitions.set(node.identifier, node.url);
      }
    });
    walk(root, (node) => {
      if ((node.type === 'link' || node.type === 'image') && node.url !== undefined) {
        validateUrl(node.url, node.type, node, context);
      } else if ((node.type === 'linkReference' || node.type === 'imageReference') && node.identifier) {
        const url = definitions.get(node.identifier);
        if (url === undefined) return;
        const kind = node.type === 'linkReference' ? 'link' : 'image';
        validateUrl(url, kind, node, context);
        // Sätteri collects inline image destinations; reference-style images need their resolved local asset too.
        if (kind === 'image' && !url.startsWith('/') && !URL.canParse(url)) {
          context.data?.astro?.localImagePaths.add(decodeURI(url));
        }
      }
    });
  },
};
