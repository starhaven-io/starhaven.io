import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { blogPostIdFromFilename, isBlogDateValue, isPlainTextMetadata, normalizeBlogDate } from './lib/blog';

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
    generateId: ({ entry }) => blogPostIdFromFilename(entry),
  }),
  schema: z
    .object({
      title: z
        .string()
        .refine(isPlainTextMetadata, { message: 'title must be plain text without markup or control characters' }),
      description: z.string().refine(isPlainTextMetadata, {
        message: 'description must be plain text without markup or control characters',
      }),
      updatedDate: z
        .union([z.string(), z.date()])
        .refine(isBlogDateValue, { message: 'updatedDate must use a valid YYYY-MM-DD date' })
        .transform(normalizeBlogDate)
        .optional(),
    })
    .strict(),
});

export const collections = { blog };
