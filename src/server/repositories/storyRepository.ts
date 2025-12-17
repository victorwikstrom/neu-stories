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
  heroImage?: {
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
    publisherName?: string;
    retrievedAt?: Date;
  }>;
  tags?: string[];
  status?: 'draft' | 'review' | 'published' | 'archived';
  promptVersion?: string;
  modelName?: string;
  generatedAt?: Date;
};

function mapPrismaSourceToDomain(prismaSource: { id: string; url: string; label: string; domain: string; type: string; publisherName: string | null; retrievedAt: Date | null }): Source {
  return {
    id: prismaSource.id,
    url: prismaSource.url,
    label: prismaSource.label,
    domain: prismaSource.domain,
    type: prismaSource.type.toLowerCase() as 'external' | 'nuo',
    publisherName: prismaSource.publisherName ?? undefined,
    retrievedAt: prismaSource.retrievedAt?.toISOString(),
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
  // Collect all unique sources from both story sources and section sources
  const sourceMap = new Map<string, Source>();
  
  // Add story-level primary sources
  prismaStory.storySources.forEach(ss => {
    const source = mapPrismaSourceToDomain(ss.source);
    sourceMap.set(source.id, source);
  });
  
  // Add section-level sources
  prismaStory.sections.forEach(section => {
    section.sectionSources.forEach(ss => {
      const source = mapPrismaSourceToDomain(ss.source);
      sourceMap.set(source.id, source);
    });
  });
  
  const story: Story = {
    id: prismaStory.id,
    slug: prismaStory.slug,
    headline: prismaStory.headline,
    summary: prismaStory.summary,
    status: prismaStory.status.toLowerCase() as 'draft' | 'review' | 'published' | 'archived' | 'discarded',
    heroImage: prismaStory.heroImageUrl && prismaStory.heroImageAlt ? {
      url: prismaStory.heroImageUrl,
      alt: prismaStory.heroImageAlt,
      sourceCredit: prismaStory.heroImageSourceCredit ?? undefined,
    } : undefined,
    sections: prismaStory.sections.map(mapPrismaSectionToDomain),
    primarySources: Array.from(sourceMap.values()),
    tags: prismaStory.tags.length > 0 ? prismaStory.tags : undefined,
    publishedAt: prismaStory.publishedAt?.toISOString(),
    discardedAt: prismaStory.discardedAt?.toISOString(),
    createdAt: prismaStory.createdAt.toISOString(),
    updatedAt: prismaStory.updatedAt.toISOString(),
    promptVersion: prismaStory.promptVersion ?? undefined,
    modelName: prismaStory.modelName ?? undefined,
    generatedAt: prismaStory.generatedAt?.toISOString(),
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

export async function getStoryById(id: string): Promise<Story | null> {
  const prismaStory = await db.story.findUnique({
    where: { id },
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

export async function getDraftStories(): Promise<Story[]> {
  const prismaStories = await db.story.findMany({
    where: {
      status: 'DRAFT',
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
      createdAt: 'desc',
    },
  });

  return prismaStories.map(mapPrismaStoryToDomain);
}

export type UpdateStoryInput = {
  headline?: string;
  summary?: string;
  sections?: Array<{
    id?: string;
    type: 'what_happened' | 'background' | 'related';
    title?: string;
    body: string;
    order: number;
    sourceIds?: string[];
  }>;
  status?: 'draft' | 'review' | 'published' | 'archived';
};

export async function updateStory(id: string, input: UpdateStoryInput): Promise<Story> {
  const updateData: Prisma.StoryUpdateInput = {};

  if (input.headline !== undefined) {
    updateData.headline = input.headline;
  }

  if (input.summary !== undefined) {
    updateData.summary = input.summary;
  }

  if (input.status !== undefined) {
    updateData.status = input.status.toUpperCase() as StoryStatus;
  }

  if (input.sections !== undefined) {
    updateData.sections = {
      deleteMany: {},
      create: input.sections.map((section) => ({
        type: mapSectionTypeToPrisma(section.type),
        title: section.title,
        body: section.body,
        order: section.order,
        sectionSources: {
          create: (section.sourceIds ?? []).map(sourceId => ({
            source: {
              connect: { id: sourceId },
            },
          })),
        },
      })),
    };
  }

  const prismaStory = await db.story.update({
    where: { id },
    data: updateData,
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

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function generateSourceLabel(url: string): string {
  const domain = extractDomain(url);
  return domain.split('.')[0] || 'source';
}

export async function createOrGetSourceFromUrl(url: string): Promise<Source> {
  const existingSource = await db.source.findFirst({
    where: { url },
  });

  if (existingSource) {
    return mapPrismaSourceToDomain(existingSource);
  }

  const domain = extractDomain(url);
  const label = generateSourceLabel(url);

  const newSource = await db.source.create({
    data: {
      url,
      label,
      domain,
      type: 'EXTERNAL',
      retrievedAt: new Date(),
    },
  });

  return mapPrismaSourceToDomain(newSource);
}

export async function publishStory(id: string): Promise<Story> {
  const story = await db.story.findUnique({
    where: { id },
    include: {
      sections: {
        include: {
          sectionSources: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  if (!story) {
    throw new Error('Story not found');
  }

  if (story.status !== 'DRAFT') {
    throw new Error('Only draft stories can be published');
  }

  // Validate that every section has at least one source
  const sectionsWithoutSources = story.sections.filter(
    section => section.sectionSources.length === 0
  );

  if (sectionsWithoutSources.length > 0) {
    const sectionErrors = sectionsWithoutSources.map(section => ({
      sectionId: section.id,
      type: section.type,
      order: section.order,
      message: 'Section must have at least one source',
    }));
    
    const error = new Error('Validation failed: Some sections are missing sources') as Error & {
      code: string;
      sectionErrors: typeof sectionErrors;
    };
    error.code = 'VALIDATION_ERROR';
    error.sectionErrors = sectionErrors;
    throw error;
  }

  const prismaStory = await db.story.update({
    where: { id },
    data: {
      status: 'PUBLISHED' as StoryStatus,
      publishedAt: new Date(),
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

export async function discardStory(id: string): Promise<Story> {
  const story = await db.story.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!story) {
    throw new Error('Story not found');
  }

  if (story.status !== 'DRAFT') {
    throw new Error('Only draft stories can be discarded');
  }

  const prismaStory = await db.story.update({
    where: { id },
    data: {
      status: 'DISCARDED' as StoryStatus,
      discardedAt: new Date(),
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
            publisherName: source.publisherName,
            retrievedAt: source.retrievedAt,
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
      heroImageUrl: input.heroImage?.url,
      heroImageAlt: input.heroImage?.alt,
      heroImageSourceCredit: input.heroImage?.sourceCredit,
      status,
      tags: input.tags ?? [],
      promptVersion: input.promptVersion,
      modelName: input.modelName,
      generatedAt: input.generatedAt,
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
      heroImageUrl: input.heroImage?.url,
      heroImageAlt: input.heroImage?.alt,
      heroImageSourceCredit: input.heroImage?.sourceCredit,
      status,
      tags: input.tags ?? [],
      promptVersion: input.promptVersion,
      modelName: input.modelName,
      generatedAt: input.generatedAt,
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

