import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSupportedFeedMarkdown, renderPostContent } from '../src/lib/rss-content.ts';

const SITE = 'https://starhaven.io';
const POST = new URL('/blog/current/', SITE);

describe('renderPostContent', () => {
  it('handles a missing body', () => {
    assert.equal(renderPostContent(undefined, SITE), '');
  });

  it('emits no script elements, even from raw HTML in Markdown', () => {
    const out = renderPostContent('before\n\n<script>alert(1)</script>\n\nafter', SITE);
    assert.ok(!out.includes('<script'));
    assert.match(out, /before/);
    assert.match(out, /after/);
  });

  it('neutralizes javascript URLs and event handlers into inert text', () => {
    const rawHtml = renderPostContent('<a href="javascript:alert(1)" onclick="alert(1)">x</a>', SITE);
    assert.equal(rawHtml, '<p>&lt;a href="javascript:alert(1)" onclick="alert(1)"&gt;x&lt;/a&gt;</p>\n');

    const markdownLink = renderPostContent('[x](javascript:alert(1))', SITE);
    assert.equal(markdownLink, '<p>[x](javascript:alert(1))</p>\n');
  });

  it('absolutizes relative links and images against the site', () => {
    const out = renderPostContent('[post](/blog/hello/) and ![alt](/img/pic.png)', SITE);
    assert.ok(out.includes('<a href="https://starhaven.io/blog/hello/">post</a>'));
    assert.ok(out.includes('<img src="https://starhaven.io/img/pic.png" alt="alt" />'));
  });

  it('resolves fragment and document-relative links against the post URL', () => {
    const out = renderPostContent('[jump](#heading) [child](other/)', POST);
    assert.ok(out.includes('href="https://starhaven.io/blog/current/#heading"'));
    assert.ok(out.includes('href="https://starhaven.io/blog/current/other/"'));
  });

  it('leaves absolute URLs alone', () => {
    const out = renderPostContent('[ext](https://example.com/a) ![i](https://example.com/i.png)', SITE);
    assert.ok(out.includes('href="https://example.com/a"'));
    assert.ok(out.includes('src="https://example.com/i.png"'));
  });

  it('rejects unsupported footnotes without rejecting examples in code fences', () => {
    assert.throws(
      () => renderPostContent('text[^1]\n\n[^1]: a note with multiple words', POST),
      /RSS rendering does not support footnotes in https:\/\/starhaven\.io\/blog\/current\//,
    );
    assert.match(renderPostContent('~~~md\n[^1]: example\n~~~', POST), /\[\^1\]: example/);
  });

  it('includes the source file name when rejecting a post body', () => {
    assert.throws(
      () => assertSupportedFeedMarkdown('text[^1]\n\n[^1]: note', 'example.md'),
      /RSS rendering does not support footnotes in example\.md/,
    );
    assert.doesNotThrow(() => assertSupportedFeedMarkdown('~~~md\n[^1]: example\n~~~', 'example.md'));
  });

  it('drops images whose source scheme is not allowed', () => {
    assert.equal(renderPostContent('![x](data:image/png;base64,iVBORw0KGgo=)', POST), '<p></p>\n');
  });

  it('renders a representative document stably', () => {
    const document = [
      '## Heading',
      '',
      'A [link](/blog/x/) and `code`.',
      '',
      '- one',
      '- two',
      '',
      '```sh',
      'brew install brewy',
      '```',
    ].join('\n');
    const expected = [
      '<h2>Heading</h2>',
      '<p>A <a href="https://starhaven.io/blog/x/">link</a> and <code>code</code>.</p>',
      '<ul>',
      '<li>one</li>',
      '<li>two</li>',
      '</ul>',
      '<pre><code>brew install brewy',
      '</code></pre>',
      '',
    ].join('\n');

    assert.equal(renderPostContent(document, SITE), expected);
  });
});
