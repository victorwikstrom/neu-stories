/**
 * API Route: POST /api/ingestion-jobs/[id]/regenerate
 * 
 * Regenerates a Nuo draft from existing extracted content
 * Useful for testing different prompts or retrying failed generations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIngestionJobById, updateIngestionJob } from '@/server/repositories/ingestionJobRepository';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/ingestion-jobs/[id]/regenerate
 * 
 * Regenerates a draft from the job's existing extracted content
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  try {
    // Get the job
    const job = await getIngestionJobById(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Validate extracted content exists
    if (!job.extractedTitle || !job.extractedText) {
      return NextResponse.json(
        { 
          error: 'Missing extracted title or text. Cannot regenerate without extracted content.',
        },
        { status: 400 }
      );
    }

    // Set status to READY_TO_GENERATE so the generate endpoint can process it
    // (The generate endpoint will transition to GENERATING after validating readiness)
    await updateIngestionJob({
      id,
      status: 'READY_TO_GENERATE',
      errorMessage: null,
    });

    // Trigger generation by calling the generate endpoint
    try {
      const generateUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ingestion-jobs/${id}/generate`;
      const generateResponse = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!generateResponse.ok) {
        const errorData = await generateResponse.json().catch(() => ({}));
        return NextResponse.json(
          errorData,
          { status: generateResponse.status }
        );
      }
      
      const generateData = await generateResponse.json();
      
      return NextResponse.json(generateData);
    } catch (generateError) {
      console.error(`[REGENERATE] Failed to trigger generation for job ${id}:`, generateError);
      
      // Try to update job to FAILED
      try {
        await updateIngestionJob({
          id,
          status: 'FAILED',
          errorMessage: generateError instanceof Error ? `[REGENERATE] ${generateError.message}` : '[REGENERATE] Unknown error',
        });
      } catch (updateError) {
        console.error('[REGENERATE] Failed to update job status:', updateError);
      }
      
      return NextResponse.json(
        { 
          error: generateError instanceof Error ? generateError.message : 'Internal server error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[REGENERATE] Endpoint error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

