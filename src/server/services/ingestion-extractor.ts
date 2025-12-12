/**
 * Ingestion extractor service
 * 
 * Handles the EXTRACTING step of the ingestion pipeline:
 * 1. Extracts title from HTML with precedence
 * 2. Extracts main article text content
 * 3. Normalizes and cleans the extracted content
 * 4. Updates job status and metadata
 */

import * as cheerio from 'cheerio';
import {
  getIngestionJobById,
  updateIngestionJob,
} from '@/server/repositories/ingestionJobRepository';
import type { IngestionJob } from '@prisma/client';

/**
 * Result of processing an extract job
 */
export interface ExtractJobResult {
  success: boolean;
  job: IngestionJob;
  error?: string;
}

/**
 * Configuration for text extraction
 */
export interface ExtractConfig {
  minTextLength?: number;
  maxTextLength?: number;
}

const DEFAULT_CONFIG: Required<ExtractConfig> = {
  minTextLength: 100,
  maxTextLength: 1000000, // 1MB of text
};

/**
 * Extracts title from HTML with precedence:
 * og:title -> twitter:title -> <title> -> first h1
 */
function extractTitle($: ReturnType<typeof cheerio.load>): string | null {
  // Try og:title
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle?.trim()) {
    return normalizeText(ogTitle);
  }

  // Try twitter:title
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  if (twitterTitle?.trim()) {
    return normalizeText(twitterTitle);
  }

  // Try <title>
  const titleTag = $('title').first().text();
  if (titleTag?.trim()) {
    return normalizeText(titleTag);
  }

  // Try first h1
  const h1 = $('h1').first().text();
  if (h1?.trim()) {
    return normalizeText(h1);
  }

  return null;
}

/**
 * Extracts main text content from HTML
 * Attempts to isolate article content, otherwise falls back to body text
 */
function extractText($: ReturnType<typeof cheerio.load>): string | null {
  // Remove unwanted elements
  $('script, style, noscript, iframe, svg').remove();
  $('nav, header, footer, aside').remove();
  $('.nav, .navigation, .menu, .sidebar, .header, .footer, .advertisement, .ads, .social-share').remove();
  $('[role="navigation"], [role="banner"], [role="complementary"]').remove();

  // Try common article selectors first
  const articleSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    '#article',
    '#content',
    '.story-body',
  ];

  for (const selector of articleSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text();
      if (text.trim().length > 200) {
        return normalizeAndCleanText(text);
      }
    }
  }

  // Fallback: extract from body
  const bodyText = $('body').text();
  if (bodyText?.trim()) {
    return normalizeAndCleanText(bodyText);
  }

  return null;
}

/**
 * Normalizes text by trimming and collapsing whitespace
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes text and removes repeated lines
 */
function normalizeAndCleanText(text: string): string {
  // Normalize whitespace
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ');

  // Split into lines and remove duplicates
  const lines = cleaned.split('\n');
  const seen = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    
    // Keep line if we haven't seen it or if it's short (likely not repeated boilerplate)
    if (!seen.has(trimmed) || trimmed.length < 30) {
      seen.add(trimmed);
      uniqueLines.push(trimmed);
    }
  }

  // Join with newlines and collapse multiple newlines
  return uniqueLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Validates extracted content meets minimum requirements
 */
function validateExtractedContent(
  title: string | null,
  text: string | null,
  config: Required<ExtractConfig>
): { valid: boolean; error?: string } {
  if (!title || title.length === 0) {
    return { valid: false, error: 'No title could be extracted' };
  }

  if (!text || text.length === 0) {
    return { valid: false, error: 'No text content could be extracted' };
  }

  if (text.length < config.minTextLength) {
    return {
      valid: false,
      error: `Text too short: ${text.length} chars (minimum: ${config.minTextLength})`,
    };
  }

  if (text.length > config.maxTextLength) {
    return {
      valid: false,
      error: `Text too long: ${text.length} chars (maximum: ${config.maxTextLength})`,
    };
  }

  return { valid: true };
}

/**
 * Extracts content from an ingestion job
 * 
 * This function:
 * 1. Retrieves the job from the database
 * 2. Validates it's in the correct state
 * 3. Extracts title and text from raw HTML
 * 4. Validates extracted content
 * 5. Updates the job status to GENERATING
 * 
 * @param jobId - The ID of the ingestion job to process
 * @param config - Optional configuration for extraction
 * @returns Result indicating success or failure
 */
export async function extractIngestionJob(
  jobId: string,
  config?: ExtractConfig
): Promise<ExtractJobResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Step 1: Get the job
  const job = await getIngestionJobById(jobId);
  
  if (!job) {
    throw new Error(`Ingestion job ${jobId} not found`);
  }

  // Step 2: Validate job status
  if (job.status !== 'EXTRACTING') {
    return {
      success: false,
      job,
      error: `Job status is ${job.status}, expected EXTRACTING`,
    };
  }

  // Step 3: Validate raw HTML exists
  if (!job.rawHtml) {
    const failedJob = await updateIngestionJob({
      id: jobId,
      status: 'FAILED',
      errorMessage: 'No raw HTML available for extraction',
    });

    return {
      success: false,
      job: failedJob,
      error: 'No raw HTML available for extraction',
    };
  }

  try {
    // Step 4: Parse HTML
    const $ = cheerio.load(job.rawHtml);

    // Step 5: Extract title and text
    const extractedTitle = extractTitle($);
    const extractedText = extractText($);

    // Step 6: Validate extracted content
    const validation = validateExtractedContent(
      extractedTitle,
      extractedText,
      finalConfig
    );

    if (!validation.valid) {
      const failedJob = await updateIngestionJob({
        id: jobId,
        status: 'FAILED',
        errorMessage: validation.error,
      });

      return {
        success: false,
        job: failedJob,
        error: validation.error,
      };
    }

    // Step 7: Update job with extracted content and move to GENERATING
    const updatedJob = await updateIngestionJob({
      id: jobId,
      status: 'GENERATING',
      extractedTitle,
      extractedText,
      extractedAt: new Date(),
      errorMessage: null,
    });

    return {
      success: true,
      job: updatedJob,
    };
  } catch (error) {
    // Step 8: Handle errors
    let errorMessage: string;
    
    if (error instanceof Error) {
      errorMessage = `Extraction error: ${error.message}`;
    } else {
      errorMessage = 'Unknown error occurred during extraction';
    }

    // Update job to FAILED status
    const failedJob = await updateIngestionJob({
      id: jobId,
      status: 'FAILED',
      errorMessage,
    });

    return {
      success: false,
      job: failedJob,
      error: errorMessage,
    };
  }
}

/**
 * Processes the next job ready for extraction
 * 
 * This is useful for background workers that poll for jobs
 * 
 * @returns The result of processing the job, or null if no jobs are ready
 */
export async function processNextExtractingJob(): Promise<ExtractJobResult | null> {
  const { getIngestionJobsByStatus } = await import('@/server/repositories/ingestionJobRepository');
  
  const extractingJobs = await getIngestionJobsByStatus('EXTRACTING', 1);
  
  if (extractingJobs.length === 0) {
    return null;
  }

  return extractIngestionJob(extractingJobs[0].id);
}

