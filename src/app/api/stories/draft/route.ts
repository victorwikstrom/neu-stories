import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertStoryDraft } from '@/server/repositories/storyRepository';
import { HeroImageSchema } from '@/lib/story-schema';

const StoryDraftInputSchema = z.object({
  slug: z.string(),
  headline: z.string(),
  summary: z.string(),
  heroImage: HeroImageSchema.optional(),
  sections: z.array(
    z.object({
      type: z.enum(['what_happened', 'background', 'related']),
      title: z.string().optional(),
      body: z.string(),
      order: z.number().int().nonnegative(),
      sourceIds: z.array(z.string()).optional(),
    })
  ),
  primarySources: z.array(
    z.object({
      id: z.string().optional(),
      url: z.string().url(),
      label: z.string(),
      domain: z.string(),
      type: z.enum(['external', 'nuo']),
      publisherName: z.string().optional(),
      retrievedAt: z.string().datetime().optional(),
    })
  ),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'review']).optional(),
  promptVersion: z.string().optional(),
  modelName: z.string().optional(),
  generatedAt: z.string().datetime().optional(),
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

    const validationResult = StoryDraftInputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const storyInput = {
      ...data,
      primarySources: data.primarySources.map(source => ({
        ...source,
        retrievedAt: source.retrievedAt ? new Date(source.retrievedAt) : undefined,
      })),
      generatedAt: data.generatedAt ? new Date(data.generatedAt) : undefined,
    };

    const story = await upsertStoryDraft(storyInput);

    return NextResponse.json(story, { status: 201 });
  } catch (error) {
    console.error('Error upserting story draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

