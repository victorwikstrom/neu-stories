import { NextRequest, NextResponse } from 'next/server';
import { publishStory } from '@/server/repositories/storyRepository';

type ValidationError = Error & {
  code?: string;
  sectionErrors?: Array<{
    sectionId: string;
    type: string;
    order: number;
    message: string;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const story = await publishStory(id);

    return NextResponse.json({
      success: true,
      story,
      message: 'Story published successfully',
    });
  } catch (error) {
    console.error('Error publishing story:', error);
    
    const validationError = error as ValidationError;
    
    // Handle validation errors with section details
    if (validationError.code === 'VALIDATION_ERROR' && validationError.sectionErrors) {
      return NextResponse.json(
        {
          error: validationError.message,
          code: 'VALIDATION_ERROR',
          sectionErrors: validationError.sectionErrors,
        },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to publish story';
    const statusCode = errorMessage.includes('not found') ? 404 : 
                       errorMessage.includes('Only draft') ? 400 : 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

