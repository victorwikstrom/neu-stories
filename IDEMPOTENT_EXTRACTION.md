# Idempotent Extraction Implementation

## Problem

The ingestion pipeline had a state-machine clash where:

1. **Fetcher auto-triggers extraction**: After fetch completes, `ingestion-fetcher.ts` automatically triggers extraction in the background (async IIFE)
2. **UI explicitly calls /extract**: The add-article UI flow also explicitly calls `/extract` endpoint after fetch
3. **Race condition**: If background extraction completes first and sets status to `READY_TO_GENERATE`, the UI's explicit `/extract` call fails with:
   ```
   "[EXTRACT] Job status is READY_TO_GENERATE, expected EXTRACTING"
   ```

## Solution

Made extraction **idempotent** with multiple safeguards:

### 1. Idempotency in `extractIngestionJob()`

**File**: `src/server/services/ingestion-extractor.ts`

Added early-return checks to make extraction idempotent:

```typescript
// If extraction already complete
if (job.status === 'READY_TO_GENERATE' && job.extractedAt && job.extractedText) {
  return { success: true, job, skipped: true };
}

// If job has progressed past extraction
if (job.status === 'GENERATING' || job.status === 'SAVED') {
  return { success: true, job, skipped: true };
}
```

**Benefits**:
- Calling `/extract` multiple times is safe
- No error thrown if extraction already complete
- Returns success with `skipped: true` flag

### 2. Compare-and-Swap Guard

Added atomic status transition to prevent double-start:

```typescript
// Only claim extraction if status is FETCHING and extractedAt is null
const claimed = await db.ingestionJob.updateMany({
  where: {
    id: jobId,
    status: 'FETCHING',
    extractedAt: null,
  },
  data: {
    status: 'EXTRACTING',
  },
});

if (claimed.count === 0) {
  // Another worker already claimed it - re-read and check if done
  const rereadJob = await getIngestionJobById(jobId);
  if (rereadJob.extractedAt && rereadJob.extractedText) {
    return { success: true, job: rereadJob, skipped: true };
  }
}
```

**Benefits**:
- Only one worker can transition FETCHING → EXTRACTING
- If update affects 0 rows, another worker already progressed
- Re-read job to check if extraction complete (idempotent)

### 3. Updated `/extract` Endpoint

**File**: `src/app/api/ingestion-jobs/[id]/extract/route.ts`

Returns 200 for both new extractions and idempotent skips:

```typescript
return NextResponse.json({
  success: true,
  skipped: result.skipped || false,  // Indicates if skipped
  job: { /* ... */ },
});
```

**Benefits**:
- No 400 error for idempotent calls
- Client can distinguish between new extraction and skip via `skipped` flag
- Consistent success response

### 4. Fixed UI Orchestration

**File**: `src/app/admin/add-article/page.tsx`

**Before** (incorrect):
```typescript
// Fetch
await fetch(`/api/ingestion-jobs/${job.id}/fetch`, { method: 'POST' });

// Explicitly call extract (causes race with auto-trigger)
await fetch(`/api/ingestion-jobs/${job.id}/extract`, { method: 'POST' });

// Generate
await fetch(`/api/ingestion-jobs/${job.id}/generate`, { method: 'POST' });
```

**After** (correct):
```typescript
// Fetch (auto-triggers extraction in background)
await fetch(`/api/ingestion-jobs/${job.id}/fetch`, { method: 'POST' });

// Poll job until extraction complete (no explicit /extract call)
while (!extractionComplete) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const pollResult = await fetch(`/api/ingestion-jobs/${job.id}`);
  const job = await pollResult.json();
  
  if (job.status === 'READY_TO_GENERATE' || job.extractedAt) {
    extractionComplete = true;
  }
}

// Generate (only after extraction confirmed complete)
await fetch(`/api/ingestion-jobs/${job.id}/generate`, { method: 'POST' });
```

**Benefits**:
- No race condition - only one extraction trigger (auto)
- Polls job status instead of explicitly calling /extract
- Clear separation: fetch auto-triggers, UI just waits
- Timeout protection (30 second max poll)

## State Machine Transitions

### Valid Status Transitions

```
QUEUED
  ↓
FETCHING (fetch in progress)
  ↓
EXTRACTING (extraction in progress, auto-triggered by fetch)
  ↓
READY_TO_GENERATE (extraction complete, ready for generation)
  ↓
GENERATING (story generation in progress)
  ↓
SAVED (story saved to database)

FAILED (can transition from any state on error)
```

### Idempotent Operations

| Current Status      | Action    | Result                                      |
|---------------------|-----------|---------------------------------------------|
| READY_TO_GENERATE   | /extract  | ✅ Success (skipped=true, no DB change)    |
| GENERATING          | /extract  | ✅ Success (skipped=true, no DB change)    |
| SAVED               | /extract  | ✅ Success (skipped=true, no DB change)    |
| EXTRACTING          | /extract  | ✅ Success (performs extraction)           |
| FETCHING            | /extract  | ✅ Success (CAS: claim then extract)       |
| QUEUED              | /extract  | ❌ Error (no rawHtml available)            |

### Compare-and-Swap Scenarios

**Scenario 1: Normal flow**
```
Job: FETCHING → Worker A claims → EXTRACTING → Worker A extracts → READY_TO_GENERATE
```

**Scenario 2: Race condition (multiple workers)**
```
Job: FETCHING
  ├─ Worker A attempts claim → Success (count=1) → Extracts
  └─ Worker B attempts claim → Fail (count=0) → Re-reads job → Sees extractedAt → Skips
```

**Scenario 3: UI calls /extract while auto-extract running**
```
Job: EXTRACTING → Background auto-extract → READY_TO_GENERATE
                → UI calls /extract → Idempotent skip (success, skipped=true)
```

## Testing Recommendations

### Unit Tests
- Call `extractIngestionJob()` twice on same job → both succeed
- Multiple concurrent calls → only one performs extraction
- Call on READY_TO_GENERATE job → returns skipped=true
- Call on GENERATING job → returns skipped=true

### Integration Tests
1. Create job → Fetch (wait for auto-extract) → Verify READY_TO_GENERATE
2. Create job → Fetch → Immediately call /extract → Both succeed
3. Create job → Manual extract twice → Second returns skipped=true

### Manual Testing
1. Submit URL via add-article page
2. Check console logs for "[EXTRACT] already extracted, skipping"
3. Verify no 400 errors in network tab
4. Verify story generates successfully

## Changed Files

1. **src/server/services/ingestion-extractor.ts**
   - Added `skipped` field to `ExtractJobResult`
   - Added idempotency checks (READY_TO_GENERATE, GENERATING, SAVED)
   - Added compare-and-swap guard for FETCHING → EXTRACTING
   - Updated documentation

2. **src/app/api/ingestion-jobs/[id]/extract/route.ts**
   - Return 200 for idempotent skips
   - Include `skipped` flag in response

3. **src/app/admin/add-article/page.tsx**
   - Removed explicit /extract call
   - Added polling loop to wait for extraction
   - Poll every 1 second, max 30 seconds
   - Check for READY_TO_GENERATE status or extractedAt timestamp

## Migration Notes

- No database migration required
- `READY_TO_GENERATE` status already exists in schema (migration: `20251215120000_add_extracted_ready_statuses`)
- Prisma client regenerated to include updated types

## Backward Compatibility

✅ **Fully backward compatible**:
- Old code calling /extract still works
- New code benefits from idempotency
- No breaking changes to API responses (only added `skipped` field)

## Monitoring

Watch for these log messages:
```
[EXTRACT] Job {id} already extracted (status={status}), skipping
[EXTRACT] Job {id} in terminal state (status={status}), skipping
[EXTRACT] Job {id} already extracted by another worker, skipping
```

These indicate idempotent skips (expected, not errors).

