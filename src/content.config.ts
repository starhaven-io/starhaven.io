import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { blogPostIdFromFilename } from './lib/blog';

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
    generateId: ({ entry }) => blogPostIdFromFilename(entry),
  }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      updatedDate: z.coerce.date().optional(),
    })
    .strict(),
});

export const collections = { blog };
