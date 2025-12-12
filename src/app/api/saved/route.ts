import { NextRequest, NextResponse } from 'next/server';
import {
  saveItem,
  removeItem,
  getSavedItemsForUser,
} from '@/server/repositories/savedItemRepository';

/**
 * Stub for getting the current authenticated user ID.
 * TODO: Replace with actual authentication logic.
 */
function getCurrentUserId(): string {
  // Placeholder - replace with actual auth implementation
  // This should throw if user is not authenticated
  const userId = 'stub-user-id';
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

/**
 * Maps API target type to Prisma enum.
 */
function mapTargetTypeToPrisma(targetType: string): 'STORY' | 'SOURCE' {
  const normalized = targetType.toUpperCase();
  if (normalized !== 'STORY' && normalized !== 'SOURCE') {
    throw new Error(`Invalid targetType: ${targetType}`);
  }
  return normalized as 'STORY' | 'SOURCE';
}

/**
 * Maps Prisma target type to API format.
 */
function mapTargetTypeToApi(targetType: string): 'story' | 'source' {
  return targetType.toLowerCase() as 'story' | 'source';
}

/**
 * GET /api/saved
 * Returns all saved items for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    const savedItems = await getSavedItemsForUser(userId);

    // Map to API format
    const response = savedItems.map(item => ({
      userId: item.userId,
      targetType: mapTargetTypeToApi(item.targetType),
      targetId: item.targetId,
      createdAt: item.createdAt.toISOString(),
    }));

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error fetching saved items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved
 * Saves an item (story or source) for the current user.
 * Body: { targetType: "story" | "source", targetId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    const body = await request.json();

    const { targetType, targetId } = body;

    // Validate input
    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    if (typeof targetType !== 'string' || typeof targetId !== 'string') {
      return NextResponse.json(
        { error: 'targetType and targetId must be strings' },
        { status: 400 }
      );
    }

    // Map and validate targetType
    let prismaTargetType: 'STORY' | 'SOURCE';
    try {
      prismaTargetType = mapTargetTypeToPrisma(targetType);
    } catch (err) {
      return NextResponse.json(
        { error: 'targetType must be "story" or "source"' },
        { status: 400 }
      );
    }

    const savedItem = await saveItem({
      userId,
      targetType: prismaTargetType,
      targetId,
    });

    // Map to API format
    const response = {
      userId: savedItem.userId,
      targetType: mapTargetTypeToApi(savedItem.targetType),
      targetId: savedItem.targetId,
      createdAt: savedItem.createdAt.toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error saving item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saved
 * Removes a saved item for the current user.
 * Body: { targetType: "story" | "source", targetId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    const body = await request.json();

    const { targetType, targetId } = body;

    // Validate input
    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    if (typeof targetType !== 'string' || typeof targetId !== 'string') {
      return NextResponse.json(
        { error: 'targetType and targetId must be strings' },
        { status: 400 }
      );
    }

    // Map and validate targetType
    let prismaTargetType: 'STORY' | 'SOURCE';
    try {
      prismaTargetType = mapTargetTypeToPrisma(targetType);
    } catch (err) {
      return NextResponse.json(
        { error: 'targetType must be "story" or "source"' },
        { status: 400 }
      );
    }

    await removeItem({
      userId,
      targetType: prismaTargetType,
      targetId,
    });

    return NextResponse.json(
      { message: 'Item removed successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Handle case where item doesn't exist (Prisma throws on delete of non-existent record)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    console.error('Error removing item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

