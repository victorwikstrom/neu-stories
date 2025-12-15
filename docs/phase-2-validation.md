# Phase 2 Validation Checklist

This document provides a manual regression checklist to verify the ingestion pipeline is working correctly after Phase 2 cleanup.

## Prerequisites

- [ ] Environment variables configured:
  - `DATABASE_URL` (connection pooling URL)
  - `DIRECT_URL` (direct database URL for migrations)
  - `OPENAI_API_KEY` (for draft generation)
- [ ] Prisma Client generated: `npx prisma generate`
- [ ] Development server running: `npm run dev`
- [ ] Database migrations applied: `npx prisma migrate deploy`

## Test Cases

### 1. Happy Path: URL → SAVED

**Objective**: Verify full pipeline works end-to-end.

**Steps**:
1. Navigate to `/admin/add-article`
2. Enter a valid news article URL (e.g., `https://www.bbc.com/news`)
3. Click "Generate"
4. Observe status transitions:
   - QUEUED → FETCHING → EXTRACTING → READY_TO_GENERATE → GENERATING → SAVED
5. Click "View job & draft story" link
6. Verify:
   - Draft story is created
   - Story has headline, summary, and sections
   - External source is linked to the story
   - Job status is SAVED
   - Job has storyId reference

**Expected Result**: ✅ Story created successfully with proper metadata and provenance.

---

### 2. Bad URL → FAILED [FETCH]

**Objective**: Verify fetch failures are handled gracefully.

**Test Cases**:

#### 2a. Invalid URL Format
- URL: `not-a-url`
- Expected: Immediate validation error (400) before job creation

#### 2b. Non-Existent Domain
- URL: `https://this-domain-does-not-exist-12345.com/article`
- Expected: Job status → FAILED with errorMessage starting with `[FETCH]`

#### 2c. HTTP Error (404)
- URL: `https://example.com/page-that-does-not-exist`
- Expected: Job status → FAILED with `[FETCH] HTTP 404` error

#### 2d. Timeout
- URL: A URL known to be slow/unresponsive
- Expected: Job status → FAILED with `[FETCH]` timeout error after ~30s

**Expected Result**: ✅ All fetch failures result in FAILED status with clear `[FETCH]` prefixed errors. No stuck FETCHING states.

---

### 3. Extraction Edge Cases → FAILED [EXTRACT]

**Objective**: Verify extraction failures are handled correctly.

**Test Cases**:

#### 3a. HTML with No Content
- URL: `https://example.com` (minimal HTML)
- Expected: 
  - Fetch succeeds (status 200)
  - Extract fails with `[EXTRACT] No title could be extracted` or `[EXTRACT] No text content could be extracted`
  - Job status → FAILED

#### 3b. Very Large HTML
- URL: A page with massive HTML (>2MB)
- Expected: Job status → FAILED with `[EXTRACT] rawHtml too large` error

**Expected Result**: ✅ Extraction failures result in FAILED status with clear `[EXTRACT]` prefixed errors.

---

### 4. Generate Without Extract → 409 NOT_READY

**Objective**: Verify generation guard prevents premature generation.

**Steps**:
1. Create a job manually via API: `POST /api/ingestion-jobs` with `{"url": "https://example.com"}`
2. Immediately try to generate: `POST /api/ingestion-jobs/{id}/generate`
3. Expected Response:
   ```json
   {
     "error": "[GENERATE] Job not ready for generation. Extraction must be complete first.",
     "code": "NOT_READY",
     "status": "QUEUED"
   }
   ```
   HTTP Status: 409 Conflict

**Expected Result**: ✅ Returns 409 with code "NOT_READY". Job status remains unchanged (NOT set to FAILED).

---

### 5. Manual Entry → SAVED

**Objective**: Verify manual content submission bypasses fetch/extract.

**Steps**:
1. Navigate to `/admin/add-article`
2. Use API directly or create UI:
   ```bash
   curl -X POST http://localhost:3000/api/ingestion-jobs \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://manual-entry.com/article",
       "manualTitle": "Test Manual Entry",
       "manualText": "This is a test article with enough text to pass validation. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
     }'
   ```
3. Get job ID from response
4. Call generate endpoint: `POST /api/ingestion-jobs/{id}/generate`
5. Verify:
   - Job was created with status READY_TO_GENERATE
   - Job has extractedAt timestamp
   - Job has manuallyProvided flag = true
   - Generation succeeds → SAVED

**Expected Result**: ✅ Manual entry bypasses fetch/extract and goes straight to generation.

---

### 6. Idempotency Tests

**Objective**: Verify services handle duplicate requests gracefully.

#### 6a. Duplicate Fetch
1. Create job: `POST /api/ingestion-jobs` with URL
2. Call fetch: `POST /api/ingestion-jobs/{id}/fetch` (wait for completion)
3. Call fetch again: `POST /api/ingestion-jobs/{id}/fetch`
4. Expected: Second fetch returns `{"success": true, "skipped": true}`

#### 6b. Duplicate Extract
1. Complete fetch step
2. Call extract: `POST /api/ingestion-jobs/{id}/extract` (wait for completion)
3. Call extract again: `POST /api/ingestion-jobs/{id}/extract`
4. Expected: Second extract returns `{"success": true, "skipped": true}`

#### 6c. Duplicate Generate
1. Complete fetch and extract steps
2. Call generate: `POST /api/ingestion-jobs/{id}/generate` (wait for completion)
3. Call generate again: `POST /api/ingestion-jobs/{id}/generate`
4. Expected: Second generate returns `{"success": true, "skipped": true, "message": "Generation already complete"}`

**Expected Result**: ✅ All endpoints are idempotent and return success with `skipped: true` when work already done.

---

### 7. Concurrent Requests

**Objective**: Verify compare-and-swap guards prevent race conditions.

**Test** (requires manual testing or script):
1. Create job: `POST /api/ingestion-jobs` with URL
2. Trigger 5 concurrent fetch requests:
   ```bash
   for i in {1..5}; do
     curl -X POST http://localhost:3000/api/ingestion-jobs/{id}/fetch &
   done
   wait
   ```
3. Verify:
   - Only ONE actual fetch occurs (check database: fetchedAt timestamp is set once)
   - All 5 requests return success (some with `skipped: true`)
   - No duplicate rawHtml storage
   - Job status is EXTRACTING (not stuck in FETCHING)

**Expected Result**: ✅ Compare-and-swap guards prevent duplicate work. No race conditions or stuck states.

---

### 8. Error Code Consistency

**Objective**: Verify all error responses follow standard format.

**Verify**:
- All 404 errors include `"code": "NOT_FOUND"`
- All NOT_READY errors return HTTP 409 with `"code": "NOT_READY"`
- All generation failures include `"code": "GENERATION_FAILED"`
- All internal errors include `"code": "INTERNAL_ERROR"`
- All error messages from services include step prefix: `[FETCH]`, `[EXTRACT]`, or `[GENERATE]`

**Expected Result**: ✅ Consistent error format across all endpoints.

---

### 9. State Machine Compliance

**Objective**: Verify no invalid state transitions occur.

**Valid Transitions**:
```
QUEUED → FETCHING → EXTRACTING → READY_TO_GENERATE → GENERATING → SAVED
Any state → FAILED
```

**Invalid Transitions to Test**:
1. Try to extract a QUEUED job → should return error
2. Try to generate a FETCHING job → should return 409 NOT_READY
3. Try to fetch a SAVED job → should return error or skip

**Expected Result**: ✅ Only valid transitions are allowed. Invalid transitions return errors without changing state.

---

## Success Criteria

All test cases above must pass for Phase 2 to be considered complete and stable.

**Key Metrics**:
- ✅ No jobs stuck in intermediate states (FETCHING, EXTRACTING, GENERATING)
- ✅ Clear error messages with step prefixes ([FETCH], [EXTRACT], [GENERATE])
- ✅ All endpoints are idempotent
- ✅ Compare-and-swap prevents race conditions
- ✅ UI orchestration works without auto-progression conflicts
- ✅ Manual entry flow works correctly

---

## Troubleshooting

### Job Stuck in FETCHING/EXTRACTING/GENERATING
**Cause**: Process crashed or timed out without updating status.  
**Fix**: 
- Check error logs for timeout/crash details
- Consider implementing heartbeat mechanism or stale job cleanup
- For now, manually update job status to FAILED in database

### Generate Returns NOT_READY
**Cause**: Extraction not complete.  
**Fix**: Check job.extractedAt, extractedTitle, extractedText are all set and non-empty

### "Prisma Client Not Generated" Error
**Cause**: Prisma Client out of sync with schema.  
**Fix**: Run `npx prisma generate`

### Connection Pool Exhaustion
**Cause**: Too many Prisma Client instances.  
**Fix**: Verify singleton pattern in `src/lib/prisma.ts` is working correctly

---

## Automation Recommendations (Future)

For CI/CD integration, consider:
1. Automated E2E tests using Playwright or Cypress
2. Integration tests for each service function
3. Database seed scripts for test fixtures
4. Mock LLM responses for deterministic testing
5. Stale job cleanup cron job/scheduled task

