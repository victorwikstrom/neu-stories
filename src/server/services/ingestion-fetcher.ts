/**
 * Ingestion fetcher service
 * 
 * Handles the FETCHING step of the ingestion pipeline:
 * 1. Validates and fetches URL content
 * 2. Stores raw HTML snapshot
 * 3. Updates job status and metadata
 * 
 * This service is idempotent and uses compare-and-swap guards.
 * The UI orchestrates the subsequent extraction step.
 */

import { fetchUrl, FetchError } from '@/lib/url-fetcher';
import { UrlValidationError } from '@/lib/url-validator';
import {
  getIngestionJobById,
  updateIngestionJob,
} from '@/server/repositories/ingestionJobRepository';
import { isReadyToFetch } from './ingestion-state-machine';
import type { IngestionJob } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Result of processing a fetch job
 */
export interface FetchJobResult {
  success: boolean;
  job: IngestionJob;
  error?: string;
  skipped?: boolean; // True if fetch was skipped (already done)
}

/**
 * Fetches content for an ingestion job
 * 
 * This function is idempotent:
 * - If fetch already complete (rawHtml exists + fetchedAt set), returns success
 * - Uses compare-and-swap to prevent concurrent fetches
 * 
 * Steps:
 * 1. Retrieves the job from the database
 * 2. Checks if fetch already done (idempotent)
 * 3. Validates it's in the correct state with compare-and-swap
 * 4. Fetches the URL content with security protections
 * 5. Stores the raw HTML and metadata
 * 6. Updates the job status to EXTRACTING
 * 
 * @param jobId - The ID of the ingestion job to process
 * @returns Result indicating success or failure
 */
export async function fetchIngestionJob(jobId: string): Promise<FetchJobResult> {
  // Step 1: Get the job
  const job = await getIngestionJobById(jobId);
  
  if (!job) {
    throw new Error(`[FETCH] Ingestion job ${jobId} not found`);
  }

  // Step 2: Idempotency check - if fetch already done, return success
  if (job.fetchedAt && job.rawHtml) {
    return {
      success: true,
      job,
      skipped: true,
    };
  }

  // Step 3: Validate job status using state machine
  if (!isReadyToFetch(job)) {
    return {
      success: false,
      job,
      error: `[FETCH] Job status is ${job.status}, expected QUEUED or FETCHING`,
    };
  }

  // Step 4: Compare-and-swap guard - claim the job for fetching
  // Only transition to FETCHING if currently QUEUED and not yet fetched
  if (job.status === 'QUEUED') {
    const claimed = await db.ingestionJob.updateMany({
      where: {
        id: jobId,
        status: 'QUEUED',
        fetchedAt: null,
      },
      data: {
        status: 'FETCHING',
        errorMessage: null,
      },
    });

    if (claimed.count === 0) {
      // Another request already claimed it - re-read and check
      const rereadJob = await getIngestionJobById(jobId);
      if (!rereadJob) {
        throw new Error(`[FETCH] Job ${jobId} disappeared during claim`);
      }

      // If already fetched, return success
      if (rereadJob.fetchedAt && rereadJob.rawHtml) {
        return {
          success: true,
          job: rereadJob,
          skipped: true,
        };
      }

      // If status changed unexpectedly, return error
      if (rereadJob.status !== 'FETCHING') {
        return {
          success: false,
          job: rereadJob,
          error: `[FETCH] Job status changed to ${rereadJob.status} during claim`,
        };
      }
    }
  }

  try {
    // Step 5: Fetch the URL with security protections
    const result = await fetchUrl(job.url, {
      timeoutMs: 30000,      // 30 seconds
      maxSizeBytes: 10485760, // 10 MB
      followRedirects: true,
      maxRedirects: 5,
    });

    // Step 6: Store the raw HTML and update metadata
    // Transition to EXTRACTING status (UI will orchestrate the extract call)
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
    // Step 7: Handle errors
    let errorMessage: string;
    
    if (error instanceof UrlValidationError) {
      errorMessage = `[FETCH] URL validation failed: ${error.message}`;
    } else if (error instanceof FetchError) {
      errorMessage = `[FETCH] Fetch failed (${error.code}): ${error.message}`;
      
      // If we got an HTTP status, store it
      if (error.status) {
        await updateIngestionJob({
          id: jobId,
          httpStatus: error.status,
        });
      }
    } else if (error instanceof Error) {
      errorMessage = `[FETCH] Unexpected error: ${error.message}`;
    } else {
      errorMessage = '[FETCH] Unknown error occurred during fetch';
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

