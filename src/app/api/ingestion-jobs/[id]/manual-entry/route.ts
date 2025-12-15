/**
 * API Route: POST /api/ingestion-jobs/[id]/manual-entry
 * 
 * Allows manual entry of title and text for a job (fallback when extraction fails)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIngestionJobById, updateIngestionJob } from '@/server/repositories/ingestionJobRepository';

const ManualEntrySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  text: z.string().min(50, 'Text must be at least 50 characters'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/ingestion-jobs/[id]/manual-entry
 * 
 * Manually provide title and text for a job, then trigger generation
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // Get the job
    const job = await getIngestionJobById(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = ManualEntrySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const { title, text } = validationResult.data;

    // Update job with manual content (keep as EXTRACTING, let generate endpoint transition to GENERATING)
    await updateIngestionJob({
      id,
      status: 'EXTRACTING',
      extractedTitle: title,
      extractedText: text,
      extractedAt: new Date(),
      errorMessage: null, // Clear any previous errors
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
          error: 'Manual content saved but generation failed',
          job: { id, status: 'EXTRACTING' },
        }, { status: 500 });
      }
      
      const generateData = await generateResponse.json();
      
      return NextResponse.json({
        success: true,
        message: 'Manual content submitted and generation completed',
        job: generateData.job,
        story: generateData.story,
      });
    } catch (generateError) {
      console.error(`[MANUAL-ENTRY] Failed to trigger generation for job ${id}:`, generateError);
      return NextResponse.json({
        success: false,
        error: 'Manual content saved but generation failed',
        job: { id, status: 'EXTRACTING' },
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Manual entry endpoint error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

