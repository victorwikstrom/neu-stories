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

    // Fetch the associated story if it exists
    let story = null;
    // @ts-expect-error - storyId exists in schema but Prisma types may need refresh
    if (job.storyId) {
      story = await db.story.findUnique({
        // @ts-expect-error - storyId exists in schema but Prisma types may need refresh
        where: { id: job.storyId },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
          storySources: {
            include: {
              source: true,
            },
          },
        },
      });
    }

    return NextResponse.json({
      id: job.id,
      url: job.url,
      status: job.status,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      fetchedAt: job.fetchedAt?.toISOString(),
      extractedAt: job.extractedAt?.toISOString(),
      generatedAt: job.generatedAt?.toISOString(),
      httpStatus: job.httpStatus,
      contentType: job.contentType,
      // @ts-expect-error - extractedTitle exists in schema but Prisma types may need refresh
      extractedTitle: job.extractedTitle,
      // @ts-expect-error - extractedText exists in schema but Prisma types may need refresh
      extractedText: job.extractedText,
      manuallyProvided: job.manuallyProvided,
      // @ts-expect-error - storyId exists in schema but Prisma types may need refresh
      storyId: job.storyId,
      story: story ? {
        id: story.id,
        slug: story.slug,
        headline: story.headline,
        summary: story.summary,
        status: story.status,
        sections: story.sections,
        primarySources: story.storySources.map(ss => ss.source),
        tags: story.tags,
        promptVersion: story.promptVersion,
        modelName: story.modelName,
        generatedAt: story.generatedAt?.toISOString(),
        createdAt: story.createdAt.toISOString(),
        updatedAt: story.updatedAt.toISOString(),
      } : null,
    });
  } catch (error) {
    console.error('Error fetching ingestion job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

