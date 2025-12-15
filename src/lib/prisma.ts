/**
 * Prisma Client Initialization
 * 
 * This module provides a singleton Prisma client instance to prevent
 * creating multiple connections during development hot reloading.
 * 
 * Connection Configuration:
 * - DATABASE_URL: Used for queries (supports connection pooling with pgbouncer)
 * - DIRECT_URL: Used for migrations (required when using pooling)
 * 
 * See: prisma/schema.prisma for datasource configuration
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Singleton pattern: reuse client in development to avoid connection exhaustion
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

