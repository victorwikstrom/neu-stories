# Idempotent Extraction - Quick Summary

## Problem Fixed
Race condition: fetch auto-triggers extraction + UI also calls /extract → status mismatch error

## Solution
Made extraction **fully idempotent** with 4 key changes:

## Changed Files

### 1. `src/server/services/ingestion-extractor.ts`
**Changes**:
- Added `skipped?: boolean` to `ExtractJobResult` 
- Added idempotency checks:
  - Return success if `status=READY_TO_GENERATE` and `extractedAt` exists
  - Return success if `status=GENERATING` or `SAVED`
- Added compare-and-swap guard:
  - Atomic `updateMany` with `WHERE status=FETCHING AND extractedAt=NULL`
  - Only one worker can claim extraction
  - If claim fails, re-read job and check if done
- Import `db` from `@/server/db` for CAS operation

### 2. `src/app/api/ingestion-jobs/[id]/extract/route.ts`
**Changes**:
- Return 200 (not 400) for idempotent skips
- Include `skipped: result.skipped || false` in response
- Success response same for both new extraction and skip

### 3. `src/app/admin/add-article/page.tsx`
**Changes**:
- **Removed** explicit `/extract` call
- **Added** polling loop after fetch:
  - Poll `/api/ingestion-jobs/${id}` every 1 second
  - Wait until `status=READY_TO_GENERATE` or `extractedAt` exists
  - Max 30 polls (30 seconds timeout)
  - Handle FAILED status
- Only call `/generate` after extraction confirmed complete

### 4. `src/lib/__examples__/ingestion-pipeline.example.ts`
**Changes**:
- Added comment explaining auto-trigger + idempotency
- Updated console log to show `(skipped - already extracted)` if needed

### 5. `IDEMPOTENT_EXTRACTION.md` (NEW)
Complete documentation of changes, state transitions, and testing recommendations

## State Machine Transitions (Final)

```
QUEUED → FETCHING → EXTRACTING → READY_TO_GENERATE → GENERATING → SAVED
                       ↓                                  ↓          ↓
                     FAILED ←────────────────────────────────────────┘
```

### Idempotent States
- ✅ `READY_TO_GENERATE` + extraction call → success (skip)
- ✅ `GENERATING` + extraction call → success (skip)  
- ✅ `SAVED` + extraction call → success (skip)
- ✅ `EXTRACTING` + extraction call → success (performs extraction)
- ✅ `FETCHING` + extraction call → success (CAS claim then extract)

## Key Benefits

1. **No race conditions**: Multiple extraction triggers are safe
2. **No errors**: Idempotent operations return success, not 400
3. **Atomic claiming**: Compare-and-swap prevents double-start
4. **Clean orchestration**: UI doesn't trigger extraction, just waits for it
5. **Backward compatible**: Old code still works

## How It Works

**Normal Flow**:
```
1. UI calls /fetch
2. Fetch service fetches HTML, sets status=EXTRACTING
3. Fetch auto-triggers extraction (async background)
4. UI polls job until status=READY_TO_GENERATE
5. UI calls /generate
```

**Race Condition Handled**:
```
1. Fetch auto-triggers extraction (Worker A)
2. Worker A: FETCHING → EXTRACTING (CAS succeeds)
3. UI/Worker B also calls /extract
4. Worker B: Reads status=EXTRACTING, sees extraction running
5. Worker A finishes: EXTRACTING → READY_TO_GENERATE
6. Worker B: Reads status=READY_TO_GENERATE, returns skipped=true ✅
```

**Double Trigger Handled**:
```
1. Worker A claims extraction (CAS: FETCHING → EXTRACTING, count=1)
2. Worker B attempts claim (CAS: FETCHING → EXTRACTING, count=0) 
3. Worker B re-reads job, sees extractedAt exists
4. Worker B returns skipped=true ✅
```

## Testing

**Verify**:
1. Submit URL via `/admin/add-article`
2. Check network tab: `/fetch` → poll `/jobs/{id}` → `/generate`
3. No explicit `/extract` call
4. No 400 errors
5. Story generates successfully

**Expected logs**:
```
[EXTRACT] Job {id} already extracted (status=READY_TO_GENERATE), skipping
```

## Migration

- ✅ No database changes needed
- ✅ Run `npx prisma generate` to update types
- ✅ `READY_TO_GENERATE` status already in schema
- ✅ Fully backward compatible

