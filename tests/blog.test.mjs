import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blogPostIdFromFilename,
  blogPostLastmodFromSource,
  formatBlogDate,
  isPlainTextMetadata,
  normalizeBlogDate,
  parseBlogPostId,
  sortBlogPosts,
} from '../src/lib/blog.ts';

describe('blog post filenames', () => {
  it('derive the post ID and publication date', () => {
    const id = blogPostIdFromFilename('2026-07-26-open-source-must-be-fun.md');

    assert.equal(id, '2026-07-26-open-source-must-be-fun');
    assert.deepEqual(parseBlogPostId(id), {
      date: new Date('2026-07-26T00:00:00.000Z'),
      slug: 'open-source-must-be-fun',
    });
  });

  it('reject malformed and nested filenames', () => {
    assert.throws(() => blogPostIdFromFilename('open-source-must-be-fun.md'), /must use YYYY-MM-DD-slug/);
    assert.throws(() => blogPostIdFromFilename('drafts/2026-07-26-example.md'), /must use YYYY-MM-DD-slug/);
    assert.throws(() => blogPostIdFromFilename('2026-07-26-example.mdx'), /must use YYYY-MM-DD-slug/);
  });

  it('reject impossible calendar dates', () => {
    assert.throws(() => blogPostIdFromFilename('2026-02-30-example.md'), /valid YYYY-MM-DD date/);
  });
});

describe('blog post last-modified dates', () => {
  it('uses a valid YAML updatedDate including comments', () => {
    const source = '---\ntitle: Example\nupdatedDate: 2026-08-02 # reviewed\n---\nBody\n';

    assert.equal(blogPostLastmodFromSource('2026-08-01-example.md', source).toISOString(), '2026-08-02T00:00:00.000Z');
  });

  it('falls back to the filename date', () => {
    const source = '---\ntitle: Example\n---\nBody\n';

    assert.equal(blogPostLastmodFromSource('2026-08-01-example.md', source).toISOString(), '2026-08-01T00:00:00.000Z');
  });

  it('rejects malformed, mistyped, and chronologically invalid frontmatter', () => {
    assert.throws(
      () => blogPostLastmodFromSource('2026-08-01-example.md', 'Body without frontmatter'),
      /must begin with YAML frontmatter/,
    );
    assert.throws(
      () => blogPostLastmodFromSource('2026-08-01-example.md', '---\nupdatedDate: [\n---\n'),
      /invalid YAML frontmatter/,
    );
    assert.throws(
      () => blogPostLastmodFromSource('2026-08-01-example.md', '---\nupdatedDate: 42\n---\n'),
      /updatedDate must be a YYYY-MM-DD string/,
    );
    for (const updatedDate of [
      '2026-02-31',
      '2026-08-02T10:00:00',
      '2026-08-02T10:00:00Z',
      '2026-08-02T10:00:00-07:00',
    ]) {
      assert.throws(
        () => blogPostLastmodFromSource('2026-08-01-example.md', `---\nupdatedDate: ${updatedDate}\n---\n`),
        /valid YYYY-MM-DD date/,
        updatedDate,
      );
    }
    assert.throws(
      () => blogPostLastmodFromSource('2026-08-01-example.md', '---\nupdatedDate: 2026-07-31\n---\n'),
      /cannot precede its publication date/,
    );

    for (const updatedDate of ['2026-07-31', '2026-02-31']) {
      assert.throws(
        () =>
          blogPostLastmodFromSource(
            '2026-08-01-example.md',
            `---\n<<: &dates\n  updatedDate: ${updatedDate}\ntitle: Example\n---\n`,
          ),
        updatedDate === '2026-07-31' ? /cannot precede its publication date/ : /valid YYYY-MM-DD date/,
        `merged ${updatedDate}`,
      );
    }
  });

  it('resolves valid YAML merge keys consistently with Astro', () => {
    const source = '---\n<<: &dates\n  updatedDate: 2026-08-02\ntitle: Example\n---\n';

    assert.equal(blogPostLastmodFromSource('2026-08-01-example.md', source).toISOString(), '2026-08-02T00:00:00.000Z');
  });

  it('normalizes quoted and parsed YAML dates to UTC midnight', () => {
    assert.equal(normalizeBlogDate('2026-08-02').toISOString(), '2026-08-02T00:00:00.000Z');
    assert.equal(normalizeBlogDate(new Date('2026-08-02T00:00:00.000Z')).toISOString(), '2026-08-02T00:00:00.000Z');
    assert.throws(() => normalizeBlogDate(new Date('2026-08-02T10:00:00.000Z')), /valid YYYY-MM-DD date/);
    assert.equal(formatBlogDate(new Date('2026-08-02T00:00:00.000Z')), '2026-08-02');
  });
});

describe('blog post ordering', () => {
  it('sorts date-prefixed IDs newest first', () => {
    const posts = [
      { id: '2026-04-17-hello-starhaven' },
      { id: '2026-07-26-open-source-must-be-fun' },
      { id: '2026-07-25-another-post' },
    ];

    assert.deepEqual(
      sortBlogPosts(posts).map((post) => post.id),
      ['2026-07-26-open-source-must-be-fun', '2026-07-25-another-post', '2026-04-17-hello-starhaven'],
    );
  });
});

describe('blog post metadata', () => {
  it('accepts plain text and rejects markup and control characters', () => {
    assert.equal(isPlainTextMetadata('Fish & chips, written plainly.'), true);
    assert.equal(isPlainTextMetadata('A <strong>formatted</strong> description.'), false);
    assert.equal(isPlainTextMetadata('A description\nwith a hidden line.'), false);
  });
});
