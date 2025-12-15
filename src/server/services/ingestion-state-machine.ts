/**
 * Ingestion Job State Machine
 * 
 * Canonical state machine definition and validation helpers for the ingestion pipeline.
 * This is the single source of truth for allowed state transitions.
 */

import type { IngestionJob, IngestionJobStatus } from '@prisma/client';

/**
 * Valid state transitions
 * 
 * Normal flow:
 *   QUEUED -> FETCHING -> EXTRACTING -> READY_TO_GENERATE -> GENERATING -> SAVED
 * 
 * Error handling:
 *   Any state -> FAILED
 */
const VALID_TRANSITIONS: Record<IngestionJobStatus, IngestionJobStatus[]> = {
  QUEUED: ['FETCHING', 'FAILED'],
  FETCHING: ['EXTRACTING', 'FAILED'],
  EXTRACTING: ['READY_TO_GENERATE', 'FAILED'],
  READY_TO_GENERATE: ['GENERATING', 'FAILED'],
  GENERATING: ['SAVED', 'FAILED'],
  SAVED: [], // Terminal state
  FAILED: [], // Terminal state
};

/**
 * Validates if a state transition is allowed
 */
export function isValidTransition(
  from: IngestionJobStatus,
  to: IngestionJobStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Checks if job is ready for fetching
 * Status must be QUEUED or FETCHING (idempotent retry)
 */
export function isReadyToFetch(job: IngestionJob): boolean {
  return job.status === 'QUEUED' || job.status === 'FETCHING';
}

/**
 * Checks if job is ready for extraction
 * Status must be FETCHING or EXTRACTING, and rawHtml must exist
 */
export function isReadyToExtract(job: IngestionJob): boolean {
  const validStatus = job.status === 'FETCHING' || job.status === 'EXTRACTING';
  return validStatus && !!job.rawHtml;
}

/**
 * Checks if extraction is already complete (idempotent check)
 * Job has extractedAt timestamp and extracted content
 */
export function isExtractionComplete(job: IngestionJob): boolean {
  return !!(
    job.extractedAt &&
    job.extractedTitle &&
    job.extractedText &&
    job.extractedTitle.trim() !== '' &&
    job.extractedText.trim() !== ''
  );
}

/**
 * Checks if job is ready for generation
 * Status must allow generation and extracted content must be present
 */
export function isReadyToGenerate(job: IngestionJob): boolean {
  const validStatus =
    job.status === 'READY_TO_GENERATE' ||
    job.status === 'GENERATING';
  
  return validStatus && isExtractionComplete(job);
}

/**
 * Checks if job is in a terminal state (no more processing)
 */
export function isTerminalState(status: IngestionJobStatus): boolean {
  return status === 'SAVED' || status === 'FAILED';
}

/**
 * Gets a human-readable error message for invalid transitions
 */
export function getTransitionError(
  from: IngestionJobStatus,
  to: IngestionJobStatus
): string {
  if (isTerminalState(from)) {
    return `Cannot transition from terminal state ${from}`;
  }
  
  return `Invalid transition from ${from} to ${to}. Allowed: ${VALID_TRANSITIONS[from].join(', ')}`;
}

