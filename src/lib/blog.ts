const BLOG_POST_ID = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const BLOG_POST_FILENAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

function publicationDate(date: string, label: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} has an invalid publication date: ${date}`);
  }
  return parsed;
}

export function parseBlogPostId(id: string): { date: Date; slug: string } {
  const match = BLOG_POST_ID.exec(id);
  if (!match) {
    throw new Error(`Blog post ID must use YYYY-MM-DD-slug: ${id}`);
  }

  return {
    date: publicationDate(match[1], id),
    slug: match[2],
  };
}

export function blogPostIdFromFilename(filename: string): string {
  const match = BLOG_POST_FILENAME.exec(filename);
  if (!match) {
    throw new Error(`Blog post filename must use YYYY-MM-DD-slug.md: ${filename}`);
  }

  const id = `${match[1]}-${match[2]}`;
  parseBlogPostId(id);
  return id;
}

export function sortBlogPosts<T extends { id: string }>(posts: T[]): T[] {
  return posts.sort((a, b) => b.id.localeCompare(a.id));
}
