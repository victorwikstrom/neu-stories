import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createIngestionJob } from '@/server/repositories/ingestionJobRepository';
import { fetchIngestionJob } from '@/server/services/ingestion-fetcher';

const CreateIngestionJobSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

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

    const { url } = validationResult.data;
    const job = await createIngestionJob({ url, status: 'QUEUED' });

    // Trigger the fetch step asynchronously
    // In production, this should be done via a message queue or background worker
    // For now, we trigger it directly but don't wait for completion
    fetchIngestionJob(job.id).catch((error) => {
      console.error(`Failed to fetch ingestion job ${job.id}:`, error);
    });

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

