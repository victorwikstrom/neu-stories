import { NextRequest, NextResponse } from 'next/server';
import { fetchIngestionJob } from '@/server/services/ingestion-fetcher';

/**
 * POST /api/ingestion-jobs/[id]/fetch
 * 
 * Triggers the fetch step for an ingestion job.
 * This endpoint initiates the URL fetching process with security protections.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await fetchIngestionJob(id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to fetch job',
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

    return NextResponse.json({
      success: true,
      job: {
        id: result.job.id,
        url: result.job.url,
        status: result.job.status,
        httpStatus: result.job.httpStatus,
        contentType: result.job.contentType,
        fetchedAt: result.job.fetchedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in fetch endpoint:', error);
    
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

