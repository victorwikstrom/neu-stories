import { z } from 'zod';

// Source Schema
export const SourceSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  label: z.string(),
  domain: z.string(),
  type: z.enum(['external', 'nuo']),
  publisherName: z.string().optional(),
  retrievedAt: z.string().datetime().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

// Section Schema
export const SectionSchema = z.object({
  id: z.string(),
  type: z.enum(['what_happened', 'background', 'related']),
  title: z.string().optional(),
  body: z.string(),
  sourceIds: z.array(z.string()).optional(),
  order: z.number().int().nonnegative(),
});

export type Section = z.infer<typeof SectionSchema>;

// Story Hero Image Schema
export const HeroImageSchema = z.object({
  url: z.string().url(),
  alt: z.string(),
  sourceCredit: z.string().optional(),
});

export type HeroImage = z.infer<typeof HeroImageSchema>;

// Story Schema
export const StorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  headline: z.string(),
  summary: z.string(),
  status: z.enum(['draft', 'review', 'published', 'archived']),
  heroImage: HeroImageSchema.optional(),
  sections: z.array(SectionSchema),
  primarySources: z.array(SourceSchema),
  tags: z.array(z.string()).optional(),
  publishedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  promptVersion: z.string().optional(),
  modelName: z.string().optional(),
  generatedAt: z.string().datetime().optional(),
});

export type Story = z.infer<typeof StorySchema>;

// SavedItem Schema
export const SavedItemSchema = z.object({
  userId: z.string(),
  targetType: z.enum(['story', 'source']),
  targetId: z.string(),
  createdAt: z.string().datetime(),
});

export type SavedItem = z.infer<typeof SavedItemSchema>;

