# Changed Files - Idempotent Extraction Implementation

## Core Implementation Changes

### 1. `src/server/services/ingestion-extractor.ts`
**Purpose**: Made extraction service fully idempotent with CAS guard

**Changes**:
- Added `skipped?: boolean` field to `ExtractJobResult` interface
- Imported `db` from `@/server/db` for atomic operations
- Added idempotency checks at function start:
  - Skip if `status=READY_TO_GENERATE` with `extractedAt` and `extractedText`
  - Skip if `status=GENERATING` or `SAVED`
- Added compare-and-swap guard for `FETCHING` → `EXTRACTING` transition:
  - Use `updateMany` with compound WHERE clause
  - Re-read job if claim fails (count=0)
  - Return success if another worker already extracted
- Updated function documentation to explain idempotency
- Added comments clarifying `READY_TO_GENERATE` is valid status

**Lines Modified**: ~100 lines (idempotency logic + CAS guard + docs)

---

### 2. `src/app/api/ingestion-jobs/[id]/extract/route.ts`
**Purpose**: Return 200 for idempotent skips instead of 400 error

**Changes**:
- Added `skipped` field to success response
- Return 200 status for both new extractions and idempotent skips
- Clients can check `skipped` flag to distinguish behavior

**Lines Modified**: ~5 lines (response object)

---

### 3. `src/app/admin/add-article/page.tsx`
**Purpose**: Fixed UI orchestration to avoid explicit `/extract` call

**Changes**:
- **Removed**: Explicit `POST /api/ingestion-jobs/${id}/extract` call
- **Added**: Polling loop after fetch completes:
  - Polls `GET /api/ingestion-jobs/${id}` every 1 second
  - Waits until `status=READY_TO_GENERATE` or `extractedAt` exists
  - Max 30 polls (30 second timeout)
  - Handles `FAILED` status gracefully
- Only proceeds to generation after extraction confirmed complete

**Lines Modified**: ~30 lines (replaced extract call with polling loop)

---

### 4. `src/lib/__examples__/ingestion-pipeline.example.ts`
**Purpose**: Updated example to document idempotency behavior

**Changes**:
- Added comment explaining fetch auto-triggers extraction
- Added note that explicit call is safe due to idempotency
- Updated console output to show "(skipped - already extracted)" if applicable

**Lines Modified**: ~5 lines (comments + output)

---

## Documentation

### 5. `IDEMPOTENT_EXTRACTION.md` (NEW)
**Purpose**: Comprehensive documentation of implementation

**Contents**:
- Problem description and solution
- Detailed explanation of each change
- State machine transitions
- Idempotent operations table
- Compare-and-swap scenarios
- Testing recommendations
- Migration notes

---

### 6. `IDEMPOTENT_EXTRACTION_SUMMARY.md` (NEW)
**Purpose**: Quick reference guide

**Contents**:
- Problem summary
- Changed files list
- State machine diagram
- Key benefits
- How it works (flow diagrams)
- Testing checklist

---

### 7. `CHANGED_FILES.md` (NEW - this file)
**Purpose**: Detailed list of all changed files

---

## No Changes Required

### Files That Don't Need Changes

✅ `src/server/services/ingestion-fetcher.ts`
- Already auto-triggers extraction (lines 86-111)
- No changes needed

✅ `src/app/api/ingestion-jobs/[id]/route.ts` (GET endpoint)
- Already returns job status and `extractedAt`
- Used by UI polling loop

✅ `src/server/repositories/ingestionJobRepository.ts`
- Repository methods work correctly as-is
- `updateIngestionJob` accepts `READY_TO_GENERATE` status

✅ `prisma/schema.prisma`
- `READY_TO_GENERATE` status already exists
- Migration `20251215120000_add_extracted_ready_statuses` already applied

---

## Migration Steps Completed

1. ✅ Regenerated Prisma client: `npx prisma generate`
2. ✅ Verified types in `node_modules/.prisma/client/index.d.ts`
3. ✅ No database migration needed (status already exists)

---

## Testing Checklist

### Manual Testing
- [ ] Submit URL via `/admin/add-article`
- [ ] Verify fetch completes successfully
- [ ] Verify no explicit `/extract` call in network tab
- [ ] Verify polling requests to GET `/api/ingestion-jobs/${id}`
- [ ] Verify generation proceeds after extraction complete
- [ ] Verify no 400 errors
- [ ] Check console logs for idempotency messages

### Expected Logs
```
[EXTRACT] Job {id} already extracted (status=READY_TO_GENERATE), skipping
```

### Unit Testing (Recommended)
- Call `extractIngestionJob()` twice on same job
- Verify both return success
- Verify second call has `skipped=true`
- Test concurrent calls with CAS guard

---

## Backward Compatibility

✅ **100% Backward Compatible**
- Existing code calling `/extract` continues to work
- New `skipped` field is optional (old clients ignore it)
- No breaking changes to API contract
- No database schema changes

---

## Key Files by Purpose

### State Machine Logic
- `src/server/services/ingestion-extractor.ts`

### API Endpoints
- `src/app/api/ingestion-jobs/[id]/extract/route.ts`

### UI Orchestration
- `src/app/admin/add-article/page.tsx`

### Examples & Docs
- `src/lib/__examples__/ingestion-pipeline.example.ts`
- `IDEMPOTENT_EXTRACTION.md`
- `IDEMPOTENT_EXTRACTION_SUMMARY.md`

---

## Summary Stats

- **Files Modified**: 4
- **Files Created**: 3 (docs)
- **Lines Changed**: ~140
- **Breaking Changes**: 0
- **Database Changes**: 0

