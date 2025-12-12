/**
 * Ingestion fetcher service
 * 
 * Handles the FETCHING step of the ingestion pipeline:
 * 1. Validates and fetches URL content
 * 2. Stores raw HTML snapshot
 * 3. Updates job status and metadata
 */

import { fetchUrl, FetchError } from '@/lib/url-fetcher';
import { UrlValidationError } from '@/lib/url-validator';
import {
  getIngestionJobById,
  updateIngestionJob,
} from '@/server/repositories/ingestionJobRepository';
import type { IngestionJob } from '@prisma/client';

/**
 * Result of processing a fetch job
 */
export interface FetchJobResult {
  success: boolean;
  job: IngestionJob;
  error?: string;
}

/**
 * Fetches content for an ingestion job
 * 
 * This function:
 * 1. Retrieves the job from the database
 * 2. Validates it's in the correct state
 * 3. Fetches the URL content with security protections
 * 4. Stores the raw HTML and metadata
 * 5. Updates the job status
 * 
 * @param jobId - The ID of the ingestion job to process
 * @returns Result indicating success or failure
 */
export async function fetchIngestionJob(jobId: string): Promise<FetchJobResult> {
  // Step 1: Get the job
  const job = await getIngestionJobById(jobId);
  
  if (!job) {
    throw new Error(`Ingestion job ${jobId} not found`);
  }

  // Step 2: Validate job status
  if (job.status !== 'QUEUED' && job.status !== 'FETCHING') {
    return {
      success: false,
      job,
      error: `Job status is ${job.status}, expected QUEUED or FETCHING`,
    };
  }

  // Step 3: Update status to FETCHING
  await updateIngestionJob({
    id: jobId,
    status: 'FETCHING',
    errorMessage: null,
  });

  try {
    // Step 4: Fetch the URL with security protections
    const result = await fetchUrl(job.url, {
      timeoutMs: 30000,      // 30 seconds
      maxSizeBytes: 10485760, // 10 MB
      followRedirects: true,
      maxRedirects: 5,
    });

    // Step 5: Store the raw HTML and update metadata
    const updatedJob = await updateIngestionJob({
      id: jobId,
      status: 'EXTRACTING',
      rawHtml: result.content,
      httpStatus: result.status,
      contentType: result.contentType,
      fetchedAt: new Date(),
      errorMessage: null,
    });

    return {
      success: true,
      job: updatedJob,
    };
  } catch (error) {
    // Step 6: Handle errors
    let errorMessage: string;
    
    if (error instanceof UrlValidationError) {
      errorMessage = `URL validation failed: ${error.message}`;
    } else if (error instanceof FetchError) {
      errorMessage = `Fetch failed (${error.code}): ${error.message}`;
      
      // If we got an HTTP status, store it
      if (error.status) {
        await updateIngestionJob({
          id: jobId,
          httpStatus: error.status,
        });
      }
    } else if (error instanceof Error) {
      errorMessage = `Unexpected error: ${error.message}`;
    } else {
      errorMessage = 'Unknown error occurred during fetch';
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
 * Processes the next queued ingestion job
 * 
 * This is useful for background workers that poll for jobs
 * 
 * @returns The result of processing the job, or null if no jobs are queued
 */
export async function processNextQueuedJob(): Promise<FetchJobResult | null> {
  const { getIngestionJobsByStatus } = await import('@/server/repositories/ingestionJobRepository');
  
  const queuedJobs = await getIngestionJobsByStatus('QUEUED', 1);
  
  if (queuedJobs.length === 0) {
    return null;
  }

  return fetchIngestionJob(queuedJobs[0].id);
}

