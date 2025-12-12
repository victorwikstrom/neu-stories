/**
 * Example: Mapping Nuo Draft to Story Schema
 * 
 * Shows how to convert the generated draft JSON into a Story
 * that can be saved to the database.
 */

import type { NuoDraftResponse } from '@/server/services/ingestion-generator';
import type { Story, Section } from '@/app/lib/story-schema';

/**
 * Maps a generated Nuo draft to Story format
 * 
 * This helper converts the LLM-generated draft into the Story schema
 * used by your database. It creates sections from what_happened and
 * background arrays.
 * 
 * @param draft - The validated draft from LLM
 * @param sourceUrl - The original article URL
 * @param options - Additional story options
 * @returns A Story object ready for database insertion
 */
export function mapDraftToStory(
  draft: NuoDraftResponse,
  sourceUrl: string,
  options: {
    promptVersion: string;
    modelName: string;
    generatedAt: Date;
    status?: 'draft' | 'review' | 'published' | 'archived';
  }
): Omit<Story, 'id' | 'slug' | 'createdAt' | 'updatedAt'> {
  const now = new Date().toISOString();

  // Create sections from what_happened
  const whatHappenedSections: Section[] = draft.what_happened.map((body, index) => ({
    id: `section-what-${index}`, // Will be replaced by database
    type: 'what_happened' as const,
    body,
    order: index,
    // Find evidence for this section
    sourceIds: findSourceIdsForClaim(`what_happened[${index}]`, draft.evidence),
  }));

  // Create sections from background
  const backgroundSections: Section[] = draft.background.map((body, index) => ({
    id: `section-bg-${index}`, // Will be replaced by database
    type: 'background' as const,
    body,
    order: whatHappenedSections.length + index,
    // Find evidence for this section
    sourceIds: findSourceIdsForClaim(`background[${index}]`, draft.evidence),
  }));

  // Parse domain from URL
  const domain = new URL(sourceUrl).hostname;

  // Create primary source
  const primarySource = {
    id: `source-${Date.now()}`, // Will be replaced by database
    url: sourceUrl,
    label: draft.headline,
    domain,
    type: 'external' as const,
    retrievedAt: now,
  };

  return {
    headline: draft.headline,
    summary: draft.short_summary,
    status: options.status || 'draft',
    sections: [...whatHappenedSections, ...backgroundSections],
    primarySources: [primarySource],
    tags: [], // Could be extracted or added later
    promptVersion: options.promptVersion,
    modelName: options.modelName,
    generatedAt: options.generatedAt.toISOString(),
  };
}

/**
 * Helper to find which sources support a given claim
 * 
 * In this simple implementation, all claims reference the same source.
 * In a more advanced system, you might have multiple sources and map
 * evidence to specific sources.
 */
function findSourceIdsForClaim(
  claimPath: string,
  evidence: NuoDraftResponse['evidence']
): string[] | undefined {
  const hasEvidence = evidence.some(e => e.claim_path === claimPath);
  
  // If there's evidence, return the source ID (which will be set by DB)
  // In practice, you'd map this to actual source IDs
  return hasEvidence ? [`source-${Date.now()}`] : undefined;
}

/**
 * Example usage with full pipeline integration
 */
export async function exampleFullPipeline() {
  // This shows the complete flow from ingestion to Story

  // Assume we have a job with extracted content
  const mockJob = {
    id: 'job-123',
    url: 'https://example.com/article',
    extractedTitle: 'Test Article',
    extractedText: 'Article content...',
    status: 'GENERATING' as const,
  };

  // Step 1: Generate draft (pseudo-code)
  const { generateNuoDraft } = await import('@/server/services/ingestion-generator');
  
  const result = await generateNuoDraft(
    mockJob.extractedTitle,
    mockJob.extractedText,
    { language: 'sv' }
  );

  if (!result.success) {
    console.error('Generation failed:', result.error);
    return;
  }

  // Step 2: Map draft to Story
  const storyData = mapDraftToStory(
    result.draft!,
    mockJob.url,
    {
      promptVersion: result.metadata.promptVersion,
      modelName: result.metadata.model,
      generatedAt: result.metadata.generatedAt,
      status: 'draft',
    }
  );

  console.log('Story ready for database:', storyData);

  // Step 3: Generate slug from headline
  const slug = generateSlug(storyData.headline);

  // Step 4: Save to database (pseudo-code)
  // const story = await storyRepository.create({
  //   ...storyData,
  //   slug,
  // });

  // Step 5: Update job status
  // await updateIngestionJob({
  //   id: mockJob.id,
  //   status: 'SAVED',
  //   generatedAt: result.metadata.generatedAt,
  // });

  console.log('Pipeline complete! Story slug:', slug);
}

/**
 * Generates a URL-safe slug from a headline
 */
export function generateSlug(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100); // Limit length
}

/**
 * Example: Mapping with evidence metadata
 * 
 * This enhanced version stores evidence in section metadata
 */
export function mapDraftToStoryWithEvidence(
  draft: NuoDraftResponse,
  sourceUrl: string,
  options: {
    promptVersion: string;
    modelName: string;
    generatedAt: Date;
  }
): Omit<Story, 'id' | 'slug' | 'createdAt' | 'updatedAt'> {
  const now = new Date().toISOString();
  const domain = new URL(sourceUrl).hostname;

  // Create sections with evidence in body
  const whatHappenedSections: Section[] = draft.what_happened.map((body, index) => {
    const claimPath = `what_happened[${index}]`;
    const evidence = draft.evidence.find(e => e.claim_path === claimPath);
    
    // Optionally append evidence as footnote
    const bodyWithEvidence = evidence
      ? `${body}\n\n*Källa: "${evidence.support}"*`
      : body;

    return {
      id: `section-what-${index}`,
      type: 'what_happened' as const,
      body: bodyWithEvidence,
      order: index,
    };
  });

  const backgroundSections: Section[] = draft.background.map((body, index) => {
    const claimPath = `background[${index}]`;
    const evidence = draft.evidence.find(e => e.claim_path === claimPath);
    
    const bodyWithEvidence = evidence
      ? `${body}\n\n*Källa: "${evidence.support}"*`
      : body;

    return {
      id: `section-bg-${index}`,
      type: 'background' as const,
      body: bodyWithEvidence,
      order: whatHappenedSections.length + index,
    };
  });

  const primarySource = {
    id: `source-${Date.now()}`,
    url: sourceUrl,
    label: draft.headline,
    domain,
    type: 'external' as const,
    retrievedAt: now,
  };

  return {
    headline: draft.headline,
    summary: draft.short_summary,
    status: 'draft',
    sections: [...whatHappenedSections, ...backgroundSections],
    primarySources: [primarySource],
    tags: extractTags(draft), // Extract potential tags
    promptVersion: options.promptVersion,
    modelName: options.modelName,
    generatedAt: options.generatedAt.toISOString(),
  };
}

/**
 * Simple tag extraction from headline and summary
 * 
 * This is a placeholder - you might want more sophisticated tagging
 */
function extractTags(draft: NuoDraftResponse): string[] {
  const text = `${draft.headline} ${draft.short_summary}`.toLowerCase();
  const tags: string[] = [];

  // Simple keyword matching (extend this as needed)
  const keywords = [
    'politik', 'ekonomi', 'miljö', 'klimat', 'hälsa', 'utbildning',
    'teknologi', 'sport', 'kultur', 'vetenskap', 'samhälle',
  ];

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      tags.push(keyword);
    }
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Example: Real-world usage with error handling
 */
export async function exampleRobustMapping(jobId: string) {
  try {
    // Import services
    const { getIngestionJobById, updateIngestionJob } = await import(
      '@/server/repositories/ingestionJobRepository'
    );
    const { generateNuoDraft } = await import(
      '@/server/services/ingestion-generator'
    );

    // Get job
    const job = await getIngestionJobById(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'GENERATING') {
      throw new Error(`Job status is ${job.status}, expected GENERATING`);
    }

    // @ts-expect-error - Type may need Prisma client restart
    if (!job.extractedTitle || !job.extractedText) {
      throw new Error('Missing extracted content');
    }

    // Generate draft
    // @ts-expect-error - Type may need Prisma client restart
    const result = await generateNuoDraft(job.extractedTitle, job.extractedText);

    if (!result.success) {
      await updateIngestionJob({
        id: jobId,
        status: 'FAILED',
        errorMessage: result.error,
      });
      throw new Error(`Draft generation failed: ${result.error}`);
    }

    // Map to Story
    const storyData = mapDraftToStory(
      result.draft!,
      job.url,
      {
        promptVersion: result.metadata.promptVersion,
        modelName: result.metadata.model,
        generatedAt: result.metadata.generatedAt,
      }
    );

    // Generate slug
    const slug = generateSlug(storyData.headline);

    // Save story (pseudo-code)
    console.log('Would save story with slug:', slug);
    // const story = await storyRepository.create({ ...storyData, slug });

    // Update job
    await updateIngestionJob({
      id: jobId,
      status: 'SAVED',
      generatedAt: result.metadata.generatedAt,
    });

    console.log('Success! Story created from job', jobId);
    
  } catch (error) {
    console.error('Error in pipeline:', error);
    throw error;
  }
}

// Example output structure
if (require.main === module) {
  const exampleDraft: NuoDraftResponse = {
    headline: 'Riksdagen antar ny klimatlag med skärpta utsläppsmål',
    short_summary: 'Riksdagen röstade med bred majoritet för en ny klimatlag som sätter bindande mål.',
    what_happened: [
      'Riksdagen röstade för den nya klimatlagen',
      'Lagen sätter mål om 60 procent minskning',
    ],
    background: [
      'Sverige har tidigare haft frivilliga klimatmål',
    ],
    evidence: [
      { claim_path: 'what_happened[0]', support: 'Riksdagen röstade igår...' },
      { claim_path: 'what_happened[1]', support: '60 procent jämfört med 1990' },
    ],
  };

  const story = mapDraftToStory(
    exampleDraft,
    'https://example.com/article',
    {
      promptVersion: 'v1.0.0',
      modelName: 'gpt-4',
      generatedAt: new Date(),
    }
  );

  console.log(JSON.stringify(story, null, 2));
}

