import { db } from '@/server/db';
import type { Story, Section, Source } from '@/lib/story-schema';
import { StorySchema } from '@/lib/story-schema';
import type { Prisma } from '@prisma/client';
import { StoryStatus } from '@prisma/client';

type PrismaStoryWithRelations = Prisma.StoryGetPayload<{
  include: {
    sections: {
      include: {
        sectionSources: {
          include: {
            source: true;
          };
        };
      };
    };
    storySources: {
      include: {
        source: true;
      };
    };
  };
}>;

export type StoryDraftInput = {
  slug: string;
  headline: string;
  summary: string;
  heroImage: {
    url: string;
    alt: string;
    sourceCredit?: string;
  };
  sections: Array<{
    type: 'what_happened' | 'background' | 'related';
    title?: string;
    body: string;
    order: number;
    sourceIds?: string[];
  }>;
  primarySources: Array<{
    id?: string;
    url: string;
    label: string;
    domain: string;
    type: 'external' | 'nuo';
  }>;
  tags?: string[];
  status?: 'draft' | 'review' | 'published' | 'archived';
};

function mapPrismaSourceToDomain(prismaSource: { id: string; url: string; label: string; domain: string; type: string }): Source {
  return {
    id: prismaSource.id,
    url: prismaSource.url,
    label: prismaSource.label,
    domain: prismaSource.domain,
    type: prismaSource.type.toLowerCase() as 'external' | 'nuo',
  };
}

function mapSectionTypeToDomain(prismaType: string): 'what_happened' | 'background' | 'related' {
  const mapping: Record<string, 'what_happened' | 'background' | 'related'> = {
    WHAT_HAPPENED: 'what_happened',
    BACKGROUND: 'background',
    RELATED: 'related',
  };
  return mapping[prismaType] ?? 'what_happened';
}

function mapSectionTypeToPrisma(domainType: 'what_happened' | 'background' | 'related'): 'WHAT_HAPPENED' | 'BACKGROUND' | 'RELATED' {
  const mapping: Record<'what_happened' | 'background' | 'related', 'WHAT_HAPPENED' | 'BACKGROUND' | 'RELATED'> = {
    what_happened: 'WHAT_HAPPENED',
    background: 'BACKGROUND',
    related: 'RELATED',
  };
  return mapping[domainType];
}

function mapPrismaSectionToDomain(prismaSection: PrismaStoryWithRelations['sections'][0]): Section {
  const sourceIds = prismaSection.sectionSources.map(ss => ss.source.id);
  return {
    id: prismaSection.id,
    type: mapSectionTypeToDomain(prismaSection.type),
    title: prismaSection.title ?? undefined,
    body: prismaSection.body,
    order: prismaSection.order,
    sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
  };
}

function mapPrismaStoryToDomain(prismaStory: PrismaStoryWithRelations): Story {
  const story: Story = {
    id: prismaStory.id,
    slug: prismaStory.slug,
    headline: prismaStory.headline,
    summary: prismaStory.summary,
    status: prismaStory.status.toLowerCase() as 'draft' | 'review' | 'published' | 'archived',
    heroImage: {
      url: prismaStory.heroImageUrl,
      alt: prismaStory.heroImageAlt,
      sourceCredit: prismaStory.heroImageSourceCredit ?? undefined,
    },
    sections: prismaStory.sections.map(mapPrismaSectionToDomain),
    primarySources: prismaStory.storySources.map(ss => mapPrismaSourceToDomain(ss.source)),
    tags: prismaStory.tags.length > 0 ? prismaStory.tags : undefined,
    publishedAt: prismaStory.publishedAt?.toISOString(),
    createdAt: prismaStory.createdAt.toISOString(),
    updatedAt: prismaStory.updatedAt.toISOString(),
  };

  return StorySchema.parse(story);
}

export async function getPublishedStories(limit: number, offset = 0): Promise<Story[]> {
  const prismaStories = await db.story.findMany({
    where: {
      status: 'PUBLISHED',
    },
    include: {
      sections: {
        include: {
          sectionSources: {
            include: {
              source: true,
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
      storySources: {
        include: {
          source: true,
        },
      },
    },
    orderBy: {
      publishedAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return prismaStories.map(mapPrismaStoryToDomain);
}

export async function getStoryBySlug(slug: string): Promise<Story | null> {
  const prismaStory = await db.story.findUnique({
    where: { slug },
    include: {
      sections: {
        include: {
          sectionSources: {
            include: {
              source: true,
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
      storySources: {
        include: {
          source: true,
        },
      },
    },
  });

  if (!prismaStory) {
    return null;
  }

  return mapPrismaStoryToDomain(prismaStory);
}

export async function upsertStoryDraft(input: StoryDraftInput): Promise<Story> {
  const status: StoryStatus = (input.status?.toUpperCase() ?? 'DRAFT') as StoryStatus;
  const sections = input.sections.map((section, index) => ({
    type: mapSectionTypeToPrisma(section.type),
    title: section.title,
    body: section.body,
    order: section.order ?? index,
    sectionSources: {
      create: (section.sourceIds ?? []).map(sourceId => ({
        source: {
          connect: { id: sourceId },
        },
      })),
    },
  }));

  const primarySourceConnections = await Promise.all(
    input.primarySources.map(async source => {
      if (source.id) {
        return { source: { connect: { id: source.id } } };
      }
      const existingSource = await db.source.findFirst({
        where: { url: source.url },
      });
      if (existingSource) {
        return { source: { connect: { id: existingSource.id } } };
      }
      return {
        source: {
          create: {
            url: source.url,
            label: source.label,
            domain: source.domain,
            type: source.type.toUpperCase() as 'EXTERNAL' | 'NUO',
          },
        },
      };
    })
  );

  const prismaStory = await db.story.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      headline: input.headline,
      summary: input.summary,
      heroImageUrl: input.heroImage.url,
      heroImageAlt: input.heroImage.alt,
      heroImageSourceCredit: input.heroImage.sourceCredit,
      status,
      tags: input.tags ?? [],
      sections: {
        create: sections.map(s => ({
          type: s.type,
          title: s.title,
          body: s.body,
          order: s.order,
          sectionSources: s.sectionSources,
        })),
      },
      storySources: {
        create: primarySourceConnections,
      },
    },
    update: {
      headline: input.headline,
      summary: input.summary,
      heroImageUrl: input.heroImage.url,
      heroImageAlt: input.heroImage.alt,
      heroImageSourceCredit: input.heroImage.sourceCredit,
      status,
      tags: input.tags ?? [],
      sections: {
        deleteMany: {},
        create: sections.map(s => ({
          type: s.type,
          title: s.title,
          body: s.body,
          order: s.order,
          sectionSources: s.sectionSources,
        })),
      },
      storySources: {
        deleteMany: {},
        create: primarySourceConnections,
      },
    },
    include: {
      sections: {
        include: {
          sectionSources: {
            include: {
              source: true,
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
      storySources: {
        include: {
          source: true,
        },
      },
    },
  });

  return mapPrismaStoryToDomain(prismaStory);
}

