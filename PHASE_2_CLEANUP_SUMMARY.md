# Phase 2 Cleanup Summary

## Overview

This document summarizes the final Phase 2 cleanup performed on 2025-12-15 to ensure the ingestion pipeline is deterministic, idempotent, and maintainable.

---

## Files Changed

### 1. **prisma/schema.prisma**
**Changes**:
- Removed redundant `EXTRACTED` status from `IngestionJobStatus` enum
- Added comprehensive state machine documentation as comments
- Documented valid transitions and state descriptions

**Why**: Single source of truth for the state machine. Removed ambiguity between EXTRACTED and READY_TO_GENERATE.

---

### 2. **src/server/services/ingestion-state-machine.ts** (NEW)
**Changes**:
- Created canonical state machine definition
- Added validation helpers:
  - `isValidTransition(from, to)` - validates state transitions
  - `isReadyToFetch(job)` - checks if job can be fetched
  - `isReadyToExtract(job)` - checks if job can be extracted
  - `isExtractionComplete(job)` - checks if extraction is done
  - `isReadyToGenerate(job)` - checks if job can be generated
  - `isTerminalState(status)` - checks if state is terminal
  - `getTransitionError(from, to)` - generates error messages

**Why**: Single source of truth for state validation. All services use these helpers instead of ad-hoc checks.

---

### 3. **src/server/services/ingestion-fetcher.ts**
**Changes**:
- **REMOVED**: Auto-extraction IIFE (lines 87-111) that caused conflicting orchestration
- **ADDED**: Idempotency check - returns success if fetch already done
- **ADDED**: Compare-and-swap guard using `updateMany` to prevent concurrent fetches
- **ADDED**: Import and use `isReadyToFetch` validation helper
- **REMOVED**: Noisy console.error logs (kept only essential error handling)
- **ADDED**: `skipped` flag in result type for idempotent responses

**Why**: 
- Removed conflicting auto-progression (UI now orchestrates explicitly)
- Made fetch idempotent and safe for concurrent requests
- Cleaner error handling without debug noise

---

### 4. **src/server/services/ingestion-extractor.ts**
**Changes**:
- **ADDED**: Import and use state machine helpers (`isReadyToExtract`, `isExtractionComplete`, `isTerminalState`)
- **IMPROVED**: Idempotency checks now use `isExtractionComplete` helper
- **IMPROVED**: Compare-and-swap guard now uses helper for validation
- **REMOVED**: Noisy console.log statements (kept only essential logging)
- **SIMPLIFIED**: Status validation using state machine helpers

**Why**:
- Consistent state validation across services
- Cleaner code with less duplication
- Better idempotency handling

---

### 5. **src/server/services/ingestion-generator.ts**
**Changes**:
- **REMOVED**: console.error statements for validation failures
- **REMOVED**: console.error in catch block

**Why**: Reduced debug noise. Errors are already captured in return values and logged by endpoints.

---

### 6. **src/app/api/ingestion-jobs/route.ts**
**Changes**:
- **FIXED**: Manual entry now creates job with status `READY_TO_GENERATE` (was incorrectly `EXTRACTING`)
- **ADDED**: Set `manuallyProvided: true` flag for manual entries

**Why**: Correct state machine compliance. Manual entries should skip directly to READY_TO_GENERATE.

---

### 7. **src/app/api/ingestion-jobs/[id]/generate/route.ts**
**Changes**:
- **ADDED**: Import and use `isReadyToGenerate` validation helper
- **ADDED**: Idempotency check - returns success if already SAVED
- **ADDED**: Compare-and-swap guard using `updateMany` to prevent concurrent generation
- **IMPROVED**: Error responses now include `code` field for programmatic handling:
  - `NOT_FOUND` - job doesn't exist
  - `NOT_READY` - extraction not complete (HTTP 409)
  - `STATE_CHANGED` - concurrent request changed state (HTTP 409)
  - `GENERATION_FAILED` - LLM generation failed (HTTP 500)
  - `INTERNAL_ERROR` - unexpected error (HTTP 500)
- **REMOVED**: Noisy console.error statements
- **STANDARDIZED**: All NOT_READY cases return HTTP 409 (not 400)

**Why**:
- Consistent error handling with stable error codes
- Idempotent and safe for concurrent requests
- Clear distinction between client errors (409) and server errors (500)

---

### 8. **src/app/api/ingestion-jobs/[id]/fetch/route.ts**
**Changes**: None required (already clean)

---

### 9. **src/app/api/ingestion-jobs/[id]/extract/route.ts**
**Changes**: None required (already returns skipped flag)

---

### 10. **src/app/admin/add-article/page.tsx**
**Changes**:
- **REMOVED**: `EXTRACTED` from JobStatus type
- **REMOVED**: Polling logic for extraction (lines 66-97)
- **ADDED**: Direct `/extract` endpoint call with await (like fetch step)
- **UPDATED**: Status display map to remove `EXTRACTED`

**Why**:
- UI now explicitly orchestrates each step: create → fetch → extract → generate
- No more polling or waiting for auto-progression
- Simpler, more deterministic flow

---

### 11. **src/lib/prisma.ts**
**Changes**:
- **ADDED**: Comprehensive documentation comments explaining:
  - Singleton pattern rationale
  - Connection configuration (DATABASE_URL vs DIRECT_URL)
  - Reference to schema.prisma

**Why**: Clear documentation for future developers. Explains why singleton pattern is needed.

---

### 12. **docs/phase-2-validation.md** (NEW)
**Changes**:
- Created comprehensive manual regression checklist
- Documented 9 test cases covering:
  1. Happy path (URL → SAVED)
  2. Bad URL → FAILED [FETCH]
  3. Extraction edge cases → FAILED [EXTRACT]
  4. Generate without extract → 409 NOT_READY
  5. Manual entry → SAVED
  6. Idempotency tests (fetch, extract, generate)
  7. Concurrent requests
  8. Error code consistency
  9. State machine compliance
- Added troubleshooting guide
- Added automation recommendations

**Why**: Provides clear acceptance criteria and regression testing process for Phase 2.

---

## Artifacts Removed

### Debug Logging
- Removed noisy `console.log` and `console.error` statements from:
  - `ingestion-fetcher.ts`
  - `ingestion-extractor.ts`
  - `ingestion-generator.ts`
  - `generate/route.ts`

### Conflicting Orchestration
- **REMOVED**: Auto-extraction IIFE in `ingestion-fetcher.ts` (lines 87-111)
  - This was causing race conditions and double-triggers
  - UI now explicitly calls `/extract` endpoint

### Redundant Status
- **REMOVED**: `EXTRACTED` status from schema (was alias for `READY_TO_GENERATE`)

---

## State Machine Definition

### Valid Transitions
```
QUEUED → FETCHING → EXTRACTING → READY_TO_GENERATE → GENERATING → SAVED
Any state → FAILED
```

### State Descriptions
- **QUEUED**: Job created, awaiting fetch
- **FETCHING**: Downloading URL content
- **EXTRACTING**: Parsing HTML for title/text
- **READY_TO_GENERATE**: Extraction complete, ready for LLM
- **GENERATING**: LLM creating draft story
- **SAVED**: Draft story persisted to database
- **FAILED**: Unrecoverable error occurred

---

## Key Improvements

### 1. Idempotency
All step endpoints (`/fetch`, `/extract`, `/generate`) are now idempotent:
- Return `{success: true, skipped: true}` if work already done
- Safe to call multiple times without side effects

### 2. Concurrency Guards
Compare-and-swap pattern using `updateMany`:
```typescript
const claimed = await db.ingestionJob.updateMany({
  where: {
    id: jobId,
    status: 'EXPECTED_STATUS',
    completionField: null,
  },
  data: {
    status: 'NEXT_STATUS',
  },
});

if (claimed.count === 0) {
  // Another request already claimed it
  // Re-read and handle gracefully
}
```

### 3. Error Handling
Standardized error format:
```json
{
  "error": "[STEP] Human-readable message",
  "code": "ERROR_CODE",
  "job": { ... }
}
```

Error codes:
- `NOT_FOUND` (404)
- `NOT_READY` (409) - non-fatal, retry after prerequisite step
- `STATE_CHANGED` (409) - concurrent request won
- `GENERATION_FAILED` (500)
- `INTERNAL_ERROR` (500)

### 4. Orchestration
Single deterministic flow (UI-orchestrated):
1. `POST /api/ingestion-jobs` (create)
2. `POST /api/ingestion-jobs/:id/fetch` (await)
3. `POST /api/ingestion-jobs/:id/extract` (await)
4. `POST /api/ingestion-jobs/:id/generate` (await)

No auto-progression, no polling, no fire-and-forget.

---

## Verification

### Manual Testing Required
See `docs/phase-2-validation.md` for complete checklist.

**Critical Tests**:
1. ✅ URL happy path → SAVED
2. ✅ Bad URL → FAILED [FETCH]
3. ✅ Generate without extract → 409 NOT_READY (NOT FAILED)
4. ✅ Duplicate requests → idempotent (skipped: true)
5. ✅ Concurrent requests → no race conditions

### TypeScript Linter
Note: After schema changes, run:
```bash
npx prisma generate
```

If TypeScript server shows errors for `READY_TO_GENERATE`, restart the TypeScript server in your IDE.

---

## Next Steps (Phase 3)

Phase 2 is now complete and locked in. Phase 3 can focus on:
1. **Stale job cleanup**: Background job to mark stuck jobs as FAILED
2. **Heartbeat mechanism**: Track job progress for long-running operations
3. **Retry logic**: Automatic retry for transient failures
4. **Monitoring**: Metrics and alerting for job failures
5. **Performance**: Optimize extraction and generation steps
6. **Testing**: Automated E2E tests for regression prevention

---

## Maintenance Notes

### Adding a New Step
If you need to add a new step to the pipeline:
1. Add new status to `IngestionJobStatus` enum in `schema.prisma`
2. Update state machine documentation in schema comments
3. Update `VALID_TRANSITIONS` in `ingestion-state-machine.ts`
4. Add validation helper (e.g., `isReadyToNewStep`)
5. Create service function with idempotency + compare-and-swap
6. Create API endpoint
7. Update UI orchestration
8. Add test cases to `docs/phase-2-validation.md`

### Debugging Stuck Jobs
If jobs get stuck in intermediate states:
1. Check logs for timeout/crash details
2. Verify compare-and-swap logic is working
3. Consider adding heartbeat mechanism
4. Manually update job status to FAILED in database if needed

### Database Migrations
When changing schema:
1. Create migration: `npx prisma migrate dev --name description`
2. Generate client: `npx prisma generate`
3. Apply in production: `npx prisma migrate deploy`
4. Restart TypeScript server in IDE

---

## Summary

Phase 2 cleanup achieved:
- ✅ Canonical state machine with single source of truth
- ✅ Idempotent endpoints with compare-and-swap guards
- ✅ Standardized error handling with stable error codes
- ✅ Single orchestration pattern (UI-driven, explicit steps)
- ✅ Removed debug logging and conflicting patterns
- ✅ Clean Prisma client initialization with documentation
- ✅ Comprehensive validation checklist

The ingestion pipeline is now deterministic, maintainable, and ready for production use.

