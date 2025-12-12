import { NextRequest, NextResponse } from 'next/server';
import { getIngestionJobById } from '@/server/repositories/ingestionJobRepository';
import { db } from '@/server/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await getIngestionJobById(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Ingestion job not found' },
        { status: 404 }
      );
    }

    // If job is SAVED, try to find the associated story
    let storySlug: string | undefined;
    if (job.status === 'SAVED') {
      // Look for a story that was created around the same time as the job
      // In a production system, you'd want a direct relationship between IngestionJob and Story
      const story = await db.story.findFirst({
        where: {
          createdAt: {
            gte: job.createdAt,
          },
          storySources: {
            some: {
              source: {
                url: job.url,
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (story) {
        storySlug = story.slug;
      }
    }

    return NextResponse.json({
      id: job.id,
      url: job.url,
      status: job.status,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      storySlug,
    });
  } catch (error) {
    console.error('Error fetching ingestion job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

