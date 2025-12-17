import { NextRequest, NextResponse } from 'next/server';
import { createOrGetSourceFromUrl } from '@/server/repositories/storyRepository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const source = await createOrGetSourceFromUrl(url);

    return NextResponse.json(source);
  } catch (error) {
    console.error('Error creating source from URL:', error);
    return NextResponse.json(
      { error: 'Failed to create source' },
      { status: 500 }
    );
  }
}

