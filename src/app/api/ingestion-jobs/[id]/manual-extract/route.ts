import { NextRequest, NextResponse } from 'next/server';
import { getIngestionJobById, updateIngestionJob } from '@/server/repositories/ingestionJobRepository';

/**
 * POST /api/ingestion-jobs/[id]/manual-extract
 * 
 * Allows manually providing article title and text content
 * This bypasses the automatic extraction step
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, text } = body;

    // Validate input
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Get the job
    const job = await getIngestionJobById(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Ingestion job not found' },
        { status: 404 }
      );
    }

    // Update job with manually provided content - set to READY_TO_GENERATE
    const updatedJob = await updateIngestionJob({
      id,
      status: 'READY_TO_GENERATE',
      extractedTitle: title.trim(),
      extractedText: text.trim(),
      extractedAt: new Date(),
      manuallyProvided: true,
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
        return NextResponse.json({
          success: false,
          error: 'Manual extraction saved but generation failed',
          job: {
            id: updatedJob.id,
            url: updatedJob.url,
            status: updatedJob.status,
            extractedTitle: updatedJob.extractedTitle,
            extractedTextLength: updatedJob.extractedText?.length || 0,
            extractedAt: updatedJob.extractedAt?.toISOString(),
            manuallyProvided: updatedJob.manuallyProvided,
          },
        }, { status: 500 });
      }
      
      const generateData = await generateResponse.json();
      
      return NextResponse.json({
        success: true,
        job: generateData.job,
        story: generateData.story,
      });
    } catch (generateError) {
      console.error(`[MANUAL-EXTRACT] Failed to trigger generation for job ${id}:`, generateError);
      return NextResponse.json({
        success: false,
        error: 'Manual extraction saved but generation failed',
        job: {
          id: updatedJob.id,
          url: updatedJob.url,
          status: updatedJob.status,
          extractedTitle: updatedJob.extractedTitle,
          extractedTextLength: updatedJob.extractedText?.length || 0,
          extractedAt: updatedJob.extractedAt?.toISOString(),
          manuallyProvided: updatedJob.manuallyProvided,
        },
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in manual-extract endpoint:', error);
    
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


