import { NextRequest, NextResponse } from 'next/server';
import { saveItem } from '@/server/repositories/savedItemRepository';

/**
 * Stub for getting the current user ID.
 * For MVP: global reading list with hardcoded user ID.
 * TODO: Replace with actual authentication logic.
 */
function getCurrentUserId(): string {
  return 'global-user';
}

/**
 * POST /api/reading-list
 * Saves a source to the reading list.
 * Body: { sourceId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId } = body;

    // Validate input
    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId is required' },
        { status: 400 }
      );
    }

    if (typeof sourceId !== 'string') {
      return NextResponse.json(
        { error: 'sourceId must be a string' },
        { status: 400 }
      );
    }

    const userId = getCurrentUserId();

    const savedItem = await saveItem({
      userId,
      targetType: 'SOURCE',
      targetId: sourceId,
    });

    return NextResponse.json(
      {
        id: `${savedItem.userId}_${savedItem.targetType}_${savedItem.targetId}`,
        sourceId: savedItem.targetId,
        createdAt: savedItem.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving to reading list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

