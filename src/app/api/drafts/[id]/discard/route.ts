import { NextRequest, NextResponse } from 'next/server';
import { discardStory } from '@/server/repositories/storyRepository';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const story = await discardStory(id);

    return NextResponse.json({
      success: true,
      story,
      message: 'Story discarded successfully',
    });
  } catch (error) {
    console.error('Error discarding story:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to discard story';
    const statusCode = errorMessage.includes('not found') ? 404 : 
                       errorMessage.includes('Only draft') ? 400 : 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

