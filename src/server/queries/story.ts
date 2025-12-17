import { db } from '@/server/db';
import { z } from 'zod';

// Source schema for depth view
const DepthSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  domain: z.string(),
  url: z.string().url(),
});

export type DepthSource = z.infer<typeof DepthSourceSchema>;

// Section schema for depth view (only what_happened and background)
const DepthSectionSchema = z.object({
  id: z.string(),
  type: z.enum(['what_happened', 'background']),
  title: z.string().nullable(),
  body: z.string(),
  order: z.number(),
  sources: z.array(DepthSourceSchema),
});

export type DepthSection = z.infer<typeof DepthSectionSchema>;

// Story depth view schema
const StoryWithDepthSchema = z.object({
  id: z.string(),
  headline: z.string(),
  summary: z.string(),
  publishedAt: z.string().datetime(),
  sections: z.array(DepthSectionSchema),
});

export type StoryWithDepth = z.infer<typeof StoryWithDepthSchema>;

/**
 * Fetches a published story with its depth view data:
 * - Only includes "what_happened" and "background" sections
 * - Sections are ordered by their order field
 * - Each section includes its associated sources
 * 
 * @param slugOrId - The slug or unique identifier of the story
 * @returns StoryWithDepth object or null if story not found or not published
 */
export async function getPublishedStoryWithDepth(
  slugOrId: string
): Promise<StoryWithDepth | null> {
  const prismaStory = await db.story.findFirst({
    where: {
      OR: [
        { slug: slugOrId },
        { id: slugOrId },
      ],
    },
    select: {
      id: true,
      headline: true,
      summary: true,
      publishedAt: true,
      status: true,
      sections: {
        where: {
          type: {
            in: ['WHAT_HAPPENED', 'BACKGROUND'],
          },
        },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          order: true,
          sectionSources: {
            select: {
              source: {
                select: {
                  id: true,
                  label: true,
                  domain: true,
                  url: true,
                },
              },
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  // Return null if story doesn't exist or is not published
  if (!prismaStory || prismaStory.status !== 'PUBLISHED' || !prismaStory.publishedAt) {
    return null;
  }

  // Map Prisma data to domain types
  const sections: DepthSection[] = prismaStory.sections.map((section) => ({
    id: section.id,
    type: section.type === 'WHAT_HAPPENED' ? 'what_happened' : 'background',
    title: section.title,
    body: section.body,
    order: section.order,
    sources: section.sectionSources.map((ss) => ({
      id: ss.source.id,
      label: ss.source.label,
      domain: ss.source.domain,
      url: ss.source.url,
    })),
  }));

  const result: StoryWithDepth = {
    id: prismaStory.id,
    headline: prismaStory.headline,
    summary: prismaStory.summary,
    publishedAt: prismaStory.publishedAt.toISOString(),
    sections,
  };

  // Validate with Zod schema
  return StoryWithDepthSchema.parse(result);
}

