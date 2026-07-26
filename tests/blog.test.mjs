import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blogPostIdFromFilename, parseBlogPostId, sortBlogPosts } from '../src/lib/blog.ts';

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
    assert.throws(() => blogPostIdFromFilename('2026-02-30-example.md'), /invalid publication date/);
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
