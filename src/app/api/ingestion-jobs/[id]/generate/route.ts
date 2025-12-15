/**
 * API Route: POST /api/ingestion-jobs/[id]/generate
 * 
 * Generates a Nuo draft from extracted content
 * Transitions job from GENERATING → SAVED (or FAILED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIngestionJobById, updateIngestionJob } from '@/server/repositories/ingestionJobRepository';
import { generateNuoDraft } from '@/server/services/ingestion-generator';
import { mapDraftToStory } from '@/server/services/draft-to-story-mapper';
import { upsertStoryDraft } from '@/server/repositories/storyRepository';
import { checkGenerateRateLimit } from '@/server/services/rate-limiter';
import { isReadyToGenerate } from '@/server/services/ingestion-state-machine';
import { db } from '@/server/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/ingestion-jobs/[id]/generate
 * 
 * Generates a draft from the job's extracted content
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  try {
    // Check rate limit first
    const rateLimitCheck = checkGenerateRateLimit(id);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please wait before retrying.',
          retryAfterMs: rateLimitCheck.remainingMs,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitCheck.remainingMs || 0) / 1000).toString(),
          },
        }
      );
    }

    // Get the job
    const job = await getIngestionJobById(id);

    if (!job) {
      return NextResponse.json(
        { 
          error: '[GENERATE] Job not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Idempotency check - if already SAVED, return success
    if (job.status === 'SAVED' && job.storyId) {
      return NextResponse.json(
        { 
          success: true,
          skipped: true,
          job,
          message: 'Generation already complete',
        },
        { status: 200 }
      );
    }

    // Validate job is ready for generation using state machine
    if (!isReadyToGenerate(job)) {
      // Return 409 NOT_READY (non-fatal, caller should retry after extraction)
      return NextResponse.json(
        { 
          error: '[GENERATE] Job not ready for generation. Extraction must be complete first.',
          code: 'NOT_READY',
          status: job.status,
          job,
        },
        { status: 409 }
      );
    }
    
    // Compare-and-swap: Transition to GENERATING only if currently READY_TO_GENERATE
    if (job.status === 'READY_TO_GENERATE') {
      const claimed = await db.ingestionJob.updateMany({
        where: {
          id,
          status: 'READY_TO_GENERATE',
          generatedAt: null,
        },
        data: {
          status: 'GENERATING',
        },
      });

      if (claimed.count === 0) {
        // Another request already claimed it - re-read and check
        const rereadJob = await getIngestionJobById(id);
        if (!rereadJob) {
          return NextResponse.json(
            { error: '[GENERATE] Job disappeared during claim', code: 'NOT_FOUND' },
            { status: 404 }
          );
        }

        // If already generated/saved, return success
        if (rereadJob.status === 'SAVED' && rereadJob.storyId) {
          return NextResponse.json(
            { 
              success: true,
              skipped: true,
              job: rereadJob,
              message: 'Generation already complete',
            },
            { status: 200 }
          );
        }

        // If status changed unexpectedly, return error
        if (rereadJob.status !== 'GENERATING') {
          return NextResponse.json(
            { 
              error: `[GENERATE] Job status changed to ${rereadJob.status} during claim`,
              code: 'STATE_CHANGED',
              job: rereadJob,
            },
            { status: 409 }
          );
        }
      }
    }

    // Generate draft
    const result = await generateNuoDraft(
      job.extractedTitle,
      job.extractedText,
      {
        language: 'sv',
        temperature: 0.1,
      }
    );

    if (!result.success || !result.draft) {
      // Update job to FAILED
      const failedJob = await updateIngestionJob({
        id,
        status: 'FAILED',
        errorMessage: `[GENERATE] ${result.error || 'Draft generation failed'}`,
      });

      return NextResponse.json(
        {
          error: result.error || 'Draft generation failed',
          code: 'GENERATION_FAILED',
          job: failedJob,
        },
        { status: 500 }
      );
    }

    // Map draft to Story format
    const storyInput = mapDraftToStory(
      result.draft,
      job.url,
      result.metadata
    );

    // Save the story to the database
    const story = await upsertStoryDraft(storyInput);

    // Update job to SAVED with story reference
    const completedJob = await updateIngestionJob({
      id,
      status: 'SAVED',
      generatedAt: result.metadata.generatedAt,
      storyId: story.id,
    });

    // Return the story and updated job
    return NextResponse.json({
      success: true,
      story,
      job: completedJob,
      metadata: result.metadata,
    });

  } catch (error) {
    // Try to update job to FAILED
    try {
      await updateIngestionJob({
        id,
        status: 'FAILED',
        errorMessage: error instanceof Error ? `[GENERATE] ${error.message}` : '[GENERATE] Unknown error',
      });
    } catch (updateError) {
      // Silently fail if unable to update status
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

