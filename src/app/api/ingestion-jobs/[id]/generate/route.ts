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
        { error: '[GENERATE] Job not found' },
        { status: 404 }
      );
    }

    // Validate job status - must be EXTRACTED, READY_TO_GENERATE, or GENERATING
    // EXTRACTED/READY_TO_GENERATE means the job is ready for generation (just extracted)
    // GENERATING means a retry or regenerate scenario
    if (
      job.status !== 'EXTRACTED' && 
      job.status !== 'READY_TO_GENERATE' && 
      job.status !== 'GENERATING'
    ) {
      return NextResponse.json(
        { 
          error: `[GENERATE] Job status is ${job.status}, expected EXTRACTED, READY_TO_GENERATE, or GENERATING`,
          job,
        },
        { status: 400 }
      );
    }

    // GATING RULE: Validate extracted content exists BEFORE transitioning to GENERATING
    // Generation may only start if extractedAt != null AND both extractedTitle + extractedText are non-empty
    if (!job.extractedAt || !job.extractedTitle || !job.extractedText || 
        job.extractedTitle.trim() === '' || job.extractedText.trim() === '') {
      // Do NOT set status to GENERATING - return 409 NOT_READY
      return NextResponse.json(
        { 
          error: 'NOT_READY',
          message: '[GENERATE] Extraction not complete. extractedAt, extractedTitle, and extractedText must all be present.',
          job,
        },
        { status: 409 }
      );
    }
    
    // Transition to GENERATING status now that we've validated readiness
    if (job.status === 'EXTRACTED' || job.status === 'READY_TO_GENERATE') {
      await updateIngestionJob({
        id,
        status: 'GENERATING',
      });
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
    console.error('[GENERATE] Endpoint error:', error);

    // Try to update job to FAILED
    try {
      await updateIngestionJob({
        id,
        status: 'FAILED',
        errorMessage: error instanceof Error ? `[GENERATE] ${error.message}` : '[GENERATE] Unknown error',
      });
    } catch (updateError) {
      console.error('[GENERATE] Failed to update job status:', updateError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

