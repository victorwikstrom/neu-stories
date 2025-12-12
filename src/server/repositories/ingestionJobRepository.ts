import { db } from '@/server/db';
import type { IngestionJob, IngestionJobStatus } from '@prisma/client';

export type CreateIngestionJobParams = {
  url: string;
  status?: IngestionJobStatus;
};

export type UpdateIngestionJobParams = {
  id: string;
  status?: IngestionJobStatus;
  errorMessage?: string | null;
  fetchedAt?: Date | null;
  extractedAt?: Date | null;
  generatedAt?: Date | null;
  httpStatus?: number | null;
  contentType?: string | null;
  rawHtml?: string | null;
  extractedTitle?: string | null;
  extractedText?: string | null;
  storyId?: string | null;
};

/**
 * Creates a new ingestion job.
 */
export async function createIngestionJob(params: CreateIngestionJobParams): Promise<IngestionJob> {
  const { url, status = 'QUEUED' } = params;

  const job = await db.ingestionJob.create({
    data: {
      url,
      status,
    },
  });

  return job;
}

/**
 * Updates an existing ingestion job.
 */
export async function updateIngestionJob(params: UpdateIngestionJobParams): Promise<IngestionJob> {
  const { id, ...data } = params;

  const job = await db.ingestionJob.update({
    where: { id },
    data,
  });

  return job;
}

/**
 * Gets an ingestion job by ID.
 */
export async function getIngestionJobById(id: string): Promise<IngestionJob | null> {
  const job = await db.ingestionJob.findUnique({
    where: { id },
  });

  return job;
}

/**
 * Gets ingestion jobs by status.
 */
export async function getIngestionJobsByStatus(status: IngestionJobStatus, limit = 50): Promise<IngestionJob[]> {
  const jobs = await db.ingestionJob.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  return jobs;
}

/**
 * Gets recent ingestion jobs with optional status filter.
 */
export async function getRecentIngestionJobs(
  options?: {
    status?: IngestionJobStatus;
    limit?: number;
  }
): Promise<IngestionJob[]> {
  const { status, limit = 50 } = options ?? {};

  const jobs = await db.ingestionJob.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return jobs;
}

