import { NextResponse } from 'next/server';
import { getDraftStories } from '@/server/repositories/storyRepository';

export async function GET() {
  try {
    const drafts = await getDraftStories();
    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Error fetching draft stories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft stories' },
      { status: 500 }
    );
  }
}

