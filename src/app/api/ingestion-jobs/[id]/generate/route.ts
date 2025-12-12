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

interface RouteParams {
  params: {
    id: string;
  };
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
  const { id } = params;

  try {
    // Get the job
    const job = await getIngestionJobById(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Validate job status
    if (job.status !== 'GENERATING') {
      return NextResponse.json(
        { 
          error: `Job status is ${job.status}, expected GENERATING`,
          job,
        },
        { status: 400 }
      );
    }

    // Validate extracted content exists
    // @ts-expect-error - extractedTitle and extractedText exist in schema but Prisma client may need restart
    if (!job.extractedTitle || !job.extractedText) {
      const failedJob = await updateIngestionJob({
        id,
        status: 'FAILED',
        errorMessage: 'Missing extracted title or text',
      });

      return NextResponse.json(
        { 
          error: 'Missing extracted title or text',
          job: failedJob,
        },
        { status: 400 }
      );
    }

    // Generate draft
    const result = await generateNuoDraft(
      // @ts-expect-error - extractedTitle and extractedText exist in schema but Prisma client may need restart
      job.extractedTitle,
      // @ts-expect-error - extractedTitle and extractedText exist in schema but Prisma client may need restart
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
        errorMessage: result.error || 'Draft generation failed',
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
    console.error('Generate endpoint error:', error);

    // Try to update job to FAILED
    try {
      await updateIngestionJob({
        id,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

