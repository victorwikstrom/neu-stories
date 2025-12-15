import { NextRequest, NextResponse } from 'next/server';
import { extractIngestionJob } from '@/server/services/ingestion-extractor';

/**
 * POST /api/ingestion-jobs/[id]/extract
 * 
 * Triggers the extraction step for an ingestion job.
 * This endpoint extracts title and text content from the raw HTML.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await extractIngestionJob(id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to extract content',
          job: {
            id: result.job.id,
            url: result.job.url,
            status: result.job.status,
            errorMessage: result.job.errorMessage,
          },
        },
        { status: 400 }
      );
    }

    // Return 200 for both new extractions and idempotent skips
    return NextResponse.json({
      success: true,
      skipped: result.skipped || false,
      job: {
        id: result.job.id,
        url: result.job.url,
        status: result.job.status,
        extractedTitle: result.job.extractedTitle,
        extractedTextLength: result.job.extractedText?.length || 0,
        extractedAt: result.job.extractedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in extract endpoint:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Ingestion job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

