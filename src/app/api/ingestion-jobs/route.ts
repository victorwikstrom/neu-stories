import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createIngestionJob } from '@/server/repositories/ingestionJobRepository';

const CreateIngestionJobSchema = z.object({
  url: z.string().url('Invalid URL format'),
  manualTitle: z.string().min(1).optional(),
  manualText: z.string().min(50).optional(),
}).refine(
  (data) => {
    // If manualTitle is provided, manualText must also be provided (and vice versa)
    if (data.manualTitle || data.manualText) {
      return data.manualTitle && data.manualText;
    }
    return true;
  },
  {
    message: 'Both manualTitle and manualText must be provided if using manual entry',
  }
);

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = CreateIngestionJobSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { url, manualTitle, manualText } = validationResult.data;
    
    // If manual content is provided, skip fetch/extract and create job ready for generation
    if (manualTitle && manualText) {
      const job = await createIngestionJob({ 
        url, 
        status: 'READY_TO_GENERATE', // Manual content provided, ready for generation
        extractedTitle: manualTitle,
        extractedText: manualText,
        extractedAt: new Date(),
        manuallyProvided: true,
      });

      // Return job - UI will orchestrate the generation step
      return NextResponse.json({
        id: job.id,
        url: job.url,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
      }, { status: 201 });
    }

    // Normal flow: create job in QUEUED state
    // UI will orchestrate fetch -> extract -> generate steps
    const job = await createIngestionJob({ url, status: 'QUEUED' });

    return NextResponse.json({
      id: job.id,
      url: job.url,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating ingestion job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

