import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSupportedFeedMarkdown, renderPostContent, renderPostDescription } from '../src/lib/rss-content.ts';

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

  it('keeps unsafe first definitions inert when labels are duplicated', () => {
    const link = renderPostContent('[link][x]\n\n[x]: javascript:alert(1)\n[x]: https://safe.example/', POST);
    assert.doesNotMatch(link, /href=/);
    assert.match(link, /javascript:alert\(1\)/);

    const image = renderPostContent('![image][x]\n\n[x]: https://tracker.example/pixel.png\n[x]: /og.png', POST);
    assert.doesNotMatch(image, /<img|tracker\.example/);
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

  it('retains external links but removes external tracking images', () => {
    const out = renderPostContent('[ext](https://example.com/a) ![i](https://example.com/i.png)', SITE);
    assert.ok(out.includes('href="https://example.com/a"'));
    assert.ok(!out.includes('<img'));
  });

  it('retains only credential-free HTTPS and mailto link targets', () => {
    const accepted = renderPostContent('[secure](https://example.com/) [mail](mailto:security@starhaven.io)', POST);
    assert.ok(accepted.includes('href="https://example.com/"'));
    assert.ok(accepted.includes('href="mailto:security@starhaven.io"'));

    for (const target of ['http://example.com/', 'ftp://example.com/', 'https://user@example.com/']) {
      assert.doesNotMatch(renderPostContent(`[unsafe](${target})`, POST), /href=/, target);
    }
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

  it('allows only credential-free same-origin HTTPS images', () => {
    const accepted = renderPostContent('![x](/images/x.png)', POST);
    assert.ok(accepted.includes('src="https://starhaven.io/images/x.png"'));

    for (const source of [
      'http://starhaven.io/x.png',
      'ftp://starhaven.io/x.png',
      '//example.com/x.png',
      'https://user@starhaven.io/x.png',
    ]) {
      assert.ok(!renderPostContent(`![x](${source})`, POST).includes('<img'), source);
    }
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

describe('renderPostDescription', () => {
  it('preserves plain prose and rejects markup or control characters', () => {
    assert.equal(renderPostDescription('Fish & chips.'), 'Fish & chips.');
    assert.throws(() => renderPostDescription('A <strong>bold</strong> summary.'), /must be plain text/);
    assert.throws(() => renderPostDescription('A hidden\nline.'), /must be plain text/);
  });
});
