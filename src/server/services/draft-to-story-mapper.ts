/**
 * Draft to Story Mapper
 * 
 * Converts an LLM-generated NuoDraftResponse to the StoryDraftInput format
 * that can be saved to the database via storyRepository.
 */

import type { NuoDraftResponse } from './ingestion-generator';
import type { StoryDraftInput } from '@/server/repositories/storyRepository';

/**
 * Generates a URL-friendly slug from a headline
 */
function generateSlug(headline: string): string {
  return headline
    .toLowerCase()
    .trim()
    // Replace Swedish characters
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    // Remove special characters and replace spaces with hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    // Add timestamp to ensure uniqueness
    .substring(0, 50) + '-' + Date.now().toString(36);
}

/**
 * Extracts the domain from a URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Generates a label for a source from its URL
 */
function generateSourceLabel(url: string): string {
  const domain = extractDomain(url);
  return domain.split('.')[0] || 'source';
}

/**
 * Maps a NuoDraftResponse to StoryDraftInput
 * 
 * @param draft - The LLM-generated draft
 * @param sourceUrl - The original URL of the article
 * @param metadata - AI provenance metadata
 * @returns StoryDraftInput ready to be saved to database
 */
export function mapDraftToStory(
  draft: NuoDraftResponse,
  sourceUrl: string,
  metadata: {
    promptVersion: string;
    model: string;
    generatedAt: Date;
  }
): StoryDraftInput {
  const startTime = Date.now();
  console.log(`[MAP] Mapping draft to story format (headline: "${draft.headline}")`);

  try {
    const slug = generateSlug(draft.headline);
    const domain = extractDomain(sourceUrl);
    const sourceLabel = generateSourceLabel(sourceUrl);

    // Create sections from what_happened and background
    const sections: StoryDraftInput['sections'] = [
      // Map what_happened to sections
      ...draft.what_happened.map((body, index) => ({
        type: 'what_happened' as const,
        body,
        order: index,
      })),
      // Map background to sections
      ...draft.background.map((body, index) => ({
        type: 'background' as const,
        body,
        order: draft.what_happened.length + index,
      })),
    ];

    // Create the primary source
    const primarySources: StoryDraftInput['primarySources'] = [
      {
        url: sourceUrl,
        label: sourceLabel,
        domain: domain,
        type: 'external' as const,
        retrievedAt: new Date(),
      },
    ];

    const result = {
      slug,
      headline: draft.headline,
      summary: draft.short_summary,
      status: 'draft',
      sections,
      primarySources,
      tags: [],
      promptVersion: metadata.promptVersion,
      modelName: metadata.model,
      generatedAt: metadata.generatedAt,
    };

    const duration = Date.now() - startTime;
    console.log(`[MAP] Completed mapping in ${duration}ms (slug: ${slug}, ${sections.length} sections)`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[MAP] Error in ${duration}ms:`, error);
    throw new Error(`[MAP] ${error instanceof Error ? error.message : 'Unknown mapping error'}`);
  }
}

