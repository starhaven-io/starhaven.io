import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { blogMarkdownPolicyPlugin } from '../src/lib/markdown.ts';

const renderer = await createSatteriMarkdownProcessor({ mdastPlugins: [blogMarkdownPolicyPlugin] });

function render(markdown) {
  return renderer.render(markdown, { fileURL: new URL('file:///content/example.md') });
}

describe('blog Markdown policy', () => {
  it('rejects raw flow and inline HTML with a useful location', async () => {
    for (const markdown of [
      '<style>body { display: none }</style>',
      '<div>trusted-looking UI</div>',
      'text <span>HTML</span>',
    ]) {
      await assert.rejects(() => render(markdown), /Raw HTML is not allowed in \/content\/example\.md:1:/);
    }
  });

  it('rejects executable links, credentialed links, and off-origin images', async () => {
    for (const markdown of [
      '[run](javascript:alert(1))',
      '[document](data:text/html,hello)',
      '[credentials](https://user@example.com/)',
      '![tracking](https://example.com/pixel.png)',
      '![tracking][pixel]\n\n[pixel]: https://example.com/pixel.png',
    ]) {
      await assert.rejects(() => render(markdown), /Markdown (?:link|image) URL is not allowed/);
    }
  });

  it('validates the rendered definition when duplicate reference labels exist', async () => {
    for (const reference of ['[label][target]', '[target][]', '[target]']) {
      await assert.rejects(
        () => render(`${reference}\n\n[target]: javascript:alert(1)\n[target]: https://safe.example/`),
        /Markdown link URL is not allowed/,
      );
    }
    for (const reference of ['![label][target]', '![target][]', '![target]']) {
      await assert.rejects(
        () => render(`${reference}\n\n[target]: https://tracker.example/pixel.png\n[target]: /og.png`),
        /Markdown image URL is not allowed/,
      );
    }
    await assert.rejects(
      () => render('[label][A  B]\n\n[a b]: javascript:alert(1)\n[A   B]: https://safe.example/'),
      /Markdown link URL is not allowed/,
    );

    const safe = await render(
      [
        '[label][target] ![image][asset]',
        '',
        '[target]: https://safe.example/',
        '[target]: javascript:alert(1)',
        '[asset]: /og.png',
        '[asset]: https://tracker.example/pixel.png',
      ].join('\n'),
    );
    assert.match(safe.code, /href="https:\/\/safe\.example\/"/);
    assert.match(safe.code, /src="\/og\.png"/);
    assert.doesNotMatch(safe.code, /javascript:|tracker\.example/);
  });

  it('preserves ordinary Markdown, GFM, autolinks, code fences, and highlighting', async () => {
    const result = await render(
      [
        '# Heading',
        '',
        'Visit https://example.com.',
        '',
        '[Feed](/rss.xml), [email](mailto:security@starhaven.io), and [reference][docs].',
        '',
        '![local image](/og.png)',
        '',
        '| A | B |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '```html',
        '<div>shown as code</div>',
        '```',
        '',
        '[docs]: https://docs.astro.build/',
      ].join('\n'),
    );

    assert.match(result.code, /<h1 id="heading">Heading<\/h1>/);
    assert.match(result.code, /<a href="https:\/\/example\.com">https:\/\/example\.com<\/a>/);
    assert.match(result.code, /<a href="\/rss\.xml">Feed<\/a>/);
    assert.match(result.code, /<a href="mailto:security@starhaven\.io">email<\/a>/);
    assert.match(result.code, /<a href="https:\/\/docs\.astro\.build\/">reference<\/a>/);
    assert.match(result.code, /<img src="\/og\.png" alt="local image">/);
    assert.match(result.code, /<table>/);
    assert.match(result.code, /shown as code/);
    assert.doesNotMatch(result.code, /<div/);
    assert.match(result.code, /<pre class="astro-code/);
    assert.deepEqual(result.metadata.headings, [{ depth: 1, slug: 'heading', text: 'Heading' }]);
  });
});
