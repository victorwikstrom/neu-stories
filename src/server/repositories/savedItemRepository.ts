import { db } from '@/server/db';
import type { SavedItem, TargetType } from '@prisma/client';

export type SaveItemParams = {
  userId: string;
  targetType: 'STORY' | 'SOURCE';
  targetId: string;
};

export type RemoveItemParams = {
  userId: string;
  targetType: 'STORY' | 'SOURCE';
  targetId: string;
};

/**
 * Saves an item (story or source) for a user.
 * Idempotent - uses upsert to avoid duplicates.
 */
export async function saveItem(params: SaveItemParams): Promise<SavedItem> {
  const { userId, targetType, targetId } = params;

  const savedItem = await db.savedItem.upsert({
    where: {
      userId_targetType_targetId: {
        userId,
        targetType,
        targetId,
      },
    },
    create: {
      userId,
      targetType,
      targetId,
    },
    update: {
      // No updates needed - just return existing if it exists
    },
  });

  return savedItem;
}

/**
 * Removes a saved item for a user.
 */
export async function removeItem(params: RemoveItemParams): Promise<void> {
  const { userId, targetType, targetId } = params;

  await db.savedItem.delete({
    where: {
      userId_targetType_targetId: {
        userId,
        targetType,
        targetId,
      },
    },
  });
}

/**
 * Gets all saved items for a user.
 */
export async function getSavedItemsForUser(userId: string): Promise<SavedItem[]> {
  const savedItems = await db.savedItem.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return savedItems;
}

