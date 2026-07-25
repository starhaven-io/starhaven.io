import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderPostContent } from '../src/lib/rss-content.ts';

const SITE = 'https://starhaven.io';

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

  it('accepts a URL object site base', () => {
    const out = renderPostContent('[x](/y/)', new URL('https://starhaven.io'));
    assert.ok(out.includes('href="https://starhaven.io/y/"'));
  });

  it('leaves absolute URLs alone', () => {
    const out = renderPostContent('[ext](https://example.com/a) ![i](https://example.com/i.png)', SITE);
    assert.ok(out.includes('href="https://example.com/a"'));
    assert.ok(out.includes('src="https://example.com/i.png"'));
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
