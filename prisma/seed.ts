import { PrismaClient, StoryStatus, SectionType, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create or find sources (they're independent)
  let source1 = await prisma.source.findFirst({
    where: { url: 'https://www.nytimes.com/2024/tech/ai-breakthrough-announced' },
  });
  if (!source1) {
    source1 = await prisma.source.create({
      data: {
        url: 'https://www.nytimes.com/2024/tech/ai-breakthrough-announced',
        label: 'New York Times',
        domain: 'nytimes.com',
        type: SourceType.EXTERNAL,
      },
    });
  }

  let source2 = await prisma.source.findFirst({
    where: { url: 'https://techcrunch.com/2024/ai-industry-analysis' },
  });
  if (!source2) {
    source2 = await prisma.source.create({
      data: {
        url: 'https://techcrunch.com/2024/ai-industry-analysis',
        label: 'TechCrunch',
        domain: 'techcrunch.com',
        type: SourceType.EXTERNAL,
      },
    });
  }

  let source3 = await prisma.source.findFirst({
    where: { url: 'https://nuo.news/original-ai-investigation' },
  });
  if (!source3) {
    source3 = await prisma.source.create({
      data: {
        url: 'https://nuo.news/original-ai-investigation',
        label: 'NUO Original Investigation',
        domain: 'nuo.news',
        type: SourceType.NUO,
      },
    });
  }

  // Upsert the story
  const storySlug = 'major-ai-breakthrough-reshapes-tech-landscape';
  
  const story = await prisma.story.upsert({
    where: { slug: storySlug },
    update: {
      status: StoryStatus.PUBLISHED,
      publishedAt: new Date('2024-12-10T14:30:00Z'),
    },
    create: {
      slug: storySlug,
      headline: 'Major AI Breakthrough Reshapes Tech Landscape',
      summary: 'Leading technology companies announce revolutionary advancements in artificial intelligence, promising to transform how we interact with digital systems. Industry experts predict widespread impact across multiple sectors.',
      status: StoryStatus.PUBLISHED,
      heroImageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200',
      heroImageAlt: 'Abstract visualization of artificial intelligence neural networks',
      heroImageSourceCredit: 'Photo by Growtika on Unsplash',
      tags: ['technology', 'artificial-intelligence', 'innovation', 'business'],
      publishedAt: new Date('2024-12-10T14:30:00Z'),
    },
  });

  // Delete existing sections and relations for clean re-seeding
  await prisma.sectionSource.deleteMany({
    where: {
      section: {
        storyId: story.id,
      },
    },
  });

  await prisma.section.deleteMany({
    where: { storyId: story.id },
  });

  // Create sections
  const section1 = await prisma.section.create({
    data: {
      storyId: story.id,
      type: SectionType.WHAT_HAPPENED,
      title: 'What Happened',
      body: 'On December 10th, 2024, three major technology companies simultaneously unveiled significant breakthroughs in artificial intelligence research. The announcements centered around new neural network architectures that demonstrate unprecedented capabilities in natural language understanding and reasoning. Early demonstrations showed systems capable of complex problem-solving tasks that were previously thought to require years of additional research.',
      order: 1,
    },
  });

  const section2 = await prisma.section.create({
    data: {
      storyId: story.id,
      type: SectionType.BACKGROUND,
      title: 'Background',
      body: 'The AI industry has been working toward this milestone for over a decade. Previous generations of AI models showed promise but faced limitations in generalizing knowledge across different domains. Researchers have long sought to create systems that can understand context more deeply and reason about complex scenarios. This breakthrough builds on years of incremental progress and represents a potential inflection point in AI development.',
      order: 2,
    },
  });

  const section3 = await prisma.section.create({
    data: {
      storyId: story.id,
      type: SectionType.RELATED,
      title: 'Related Developments',
      body: 'This announcement follows increased investment in AI research across the tech sector. Regulatory bodies worldwide have been developing frameworks for AI governance, anticipating rapid advances in capability. Educational institutions are expanding AI curricula to prepare the workforce for an AI-integrated future. The breakthrough is expected to accelerate these trends and spark new conversations about AI\'s role in society.',
      order: 3,
    },
  });

  // Create StorySource relationships
  await prisma.storySource.upsert({
    where: {
      storyId_sourceId: {
        storyId: story.id,
        sourceId: source1.id,
      },
    },
    update: {},
    create: {
      storyId: story.id,
      sourceId: source1.id,
    },
  });

  await prisma.storySource.upsert({
    where: {
      storyId_sourceId: {
        storyId: story.id,
        sourceId: source2.id,
      },
    },
    update: {},
    create: {
      storyId: story.id,
      sourceId: source2.id,
    },
  });

  await prisma.storySource.upsert({
    where: {
      storyId_sourceId: {
        storyId: story.id,
        sourceId: source3.id,
      },
    },
    update: {},
    create: {
      storyId: story.id,
      sourceId: source3.id,
    },
  });

  // Create SectionSource relationships
  // Link section 1 (What Happened) to all sources
  await prisma.sectionSource.create({
    data: {
      sectionId: section1.id,
      sourceId: source1.id,
    },
  });

  await prisma.sectionSource.create({
    data: {
      sectionId: section1.id,
      sourceId: source2.id,
    },
  });

  // Link section 2 (Background) to source3 (NUO investigation)
  await prisma.sectionSource.create({
    data: {
      sectionId: section2.id,
      sourceId: source3.id,
    },
  });

  // Link section 3 (Related) to source2
  await prisma.sectionSource.create({
    data: {
      sectionId: section3.id,
      sourceId: source2.id,
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log(`📰 Created story: "${story.headline}"`);
  console.log(`🔗 Story slug: ${story.slug}`);
  console.log(`📊 Sections: ${3}, Sources: ${3}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

