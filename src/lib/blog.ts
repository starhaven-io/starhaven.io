import { parse as parseYaml } from 'yaml';

const BLOG_POST_ID = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const BLOG_POST_FILENAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const METADATA_MARKUP = /[<>\u0000-\u001f\u007f-\u009f]/u;

function calendarDate(date: string, label: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} must use a valid YYYY-MM-DD date: ${date}`);
  }
  return parsed;
}

export function parseBlogPostId(id: string): { date: Date; slug: string } {
  const match = BLOG_POST_ID.exec(id);
  if (!match) {
    throw new Error(`Blog post ID must use YYYY-MM-DD-slug: ${id}`);
  }

  return {
    date: calendarDate(match[1], id),
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

export function isPlainTextMetadata(value: string): boolean {
  return !METADATA_MARKUP.test(value);
}

export function isBlogDateValue(value: string | Date): boolean {
  if (typeof value === 'string') {
    try {
      calendarDate(value, 'updatedDate');
      return true;
    } catch {
      return false;
    }
  }
  return !Number.isNaN(value.valueOf()) && value.toISOString().endsWith('T00:00:00.000Z');
}

export function normalizeBlogDate(value: string | Date): Date {
  if (typeof value === 'string') return calendarDate(value, 'updatedDate');
  if (!isBlogDateValue(value)) throw new Error('updatedDate must use a valid YYYY-MM-DD date');
  return new Date(value.valueOf());
}

export function formatBlogDate(value: Date): string {
  if (!isBlogDateValue(value)) throw new Error('blog date must be normalized to UTC midnight');
  return value.toISOString().slice(0, 10);
}

export function blogPostLastmodFromSource(filename: string, source: string): Date {
  const id = blogPostIdFromFilename(filename);
  const published = parseBlogPostId(id).date;
  const frontmatterMatch = FRONTMATTER.exec(source);
  if (!frontmatterMatch) {
    throw new Error(`${filename} must begin with YAML frontmatter`);
  }

  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(frontmatterMatch[1], { merge: true });
  } catch (error) {
    throw new Error(`${filename} has invalid YAML frontmatter`, { cause: error });
  }

  if (frontmatter === null || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error(`${filename} frontmatter must be a mapping`);
  }

  const updatedValue = (frontmatter as Record<string, unknown>).updatedDate;
  if (updatedValue === undefined) return published;
  if (typeof updatedValue !== 'string') throw new Error(`${filename} updatedDate must be a YYYY-MM-DD string`);

  const updated = calendarDate(updatedValue, `${filename} updatedDate`);
  if (updated < published) {
    throw new Error(`${filename} updatedDate cannot precede its publication date`);
  }
  return updated;
}

export function sortBlogPosts<T extends { id: string }>(posts: T[]): T[] {
  return posts.sort((a, b) => b.id.localeCompare(a.id));
}
