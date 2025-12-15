# Manual Content Fallback Feature

## Overview

The manual fallback feature allows users to manually provide article title and text content when automatic extraction fails or when they prefer to paste content directly.

## Implementation

### 1. Database Schema

Added a `manuallyProvided` boolean field to the `IngestionJob` model:

```prisma
model IngestionJob {
  // ... existing fields ...
  
  // Extracted content from HTML
  extractedTitle String?
  extractedText  String?
  
  // Manual fallback flag
  manuallyProvided Boolean @default(false)
  
  // ... rest of fields ...
}
```

### 2. API Endpoint

Created a new endpoint: `POST /api/ingestion-jobs/[id]/manual-extract`

**Request Body:**
```json
{
  "title": "Article Title",
  "text": "Article content text..."
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "...",
    "url": "...",
    "status": "GENERATING",
    "extractedTitle": "Article Title",
    "extractedTextLength": 1234,
    "extractedAt": "2024-01-01T00:00:00.000Z",
    "manuallyProvided": true
  }
}
```

**Behavior:**
- Validates that both title and text are provided
- Updates the job with the manually provided content
- Sets `manuallyProvided` flag to `true`
- Transitions job status directly to `GENERATING`
- Clears any previous error messages

### 3. UI Changes

Modified `/admin/jobs/[id]` page to include:

1. **Manual Input Section**
   - Shows when job status is FAILED, QUEUED, FETCHING, or EXTRACTING
   - Only visible if no extracted text exists yet
   - Collapsible panel with clear instructions
   - Two input fields:
     - Text input for article title
     - Large textarea for article content (12 rows)
   - Submit button that:
     - Is disabled when either field is empty
     - Shows "Processing..." state during submission
     - Triggers both manual-extract and generate endpoints

2. **Status Indicator**
   - Blue info badge showing "Content was manually provided" when `manuallyProvided` is true

### 4. User Flow

**Scenario 1: Extraction Failed**
1. User submits a URL for ingestion
2. Automatic extraction fails (status: FAILED)
3. User navigates to job review page
4. Manual input section is visible
5. User clicks "Paste Content Manually" to expand
6. User pastes title and text content
7. User clicks "Submit & Generate Draft"
8. System:
   - Saves manual content to job
   - Sets manuallyProvided flag
   - Transitions to GENERATING status
   - Runs LLM generation pipeline
   - Maps draft to story format
   - Saves story to database

**Scenario 2: User Prefers Manual Input**
1. User can choose to use manual input at any point before extraction completes
2. Same flow as above

### 5. Integration with Existing Pipeline

The manual content submission integrates seamlessly with the existing pipeline:

1. **Manual Extract** (`/api/ingestion-jobs/[id]/manual-extract`)
   - Stores content in `extractedTitle` and `extractedText`
   - Sets `manuallyProvided = true`
   - Moves job to `GENERATING` status

2. **Generate** (`/api/ingestion-jobs/[id]/generate`)
   - Uses the same logic regardless of whether content was extracted or manually provided
   - Reads from `extractedTitle` and `extractedText`
   - Generates draft using LLM
   - Maps to story format
   - Saves to database

3. **Regenerate** (`/api/ingestion-jobs/[id]/regenerate`)
   - Works with manually provided content
   - Re-runs generation from existing extracted content

## Files Modified

1. `prisma/schema.prisma` - Added `manuallyProvided` field
2. `src/server/repositories/ingestionJobRepository.ts` - Updated types to include `manuallyProvided`
3. `src/app/api/ingestion-jobs/[id]/manual-extract/route.ts` - New endpoint
4. `src/app/api/ingestion-jobs/[id]/route.ts` - Added `manuallyProvided` to response
5. `src/app/admin/jobs/[id]/page.tsx` - Added manual input UI

## Testing

To test the manual fallback:

1. Start the development server: `npm run dev`
2. Navigate to `/admin/add-article`
3. Submit a URL that will fail extraction (or any URL)
4. Navigate to the job review page
5. If extraction failed or hasn't completed, the manual input section will be visible
6. Click "Paste Content Manually"
7. Enter a title and paste some text content
8. Click "Submit & Generate Draft"
9. Verify:
   - Job status changes to GENERATING
   - Blue badge shows "Content was manually provided"
   - Draft is generated successfully
   - Story appears in the preview section

## Benefits

1. **Resilience** - System can handle extraction failures gracefully
2. **Flexibility** - Users can choose manual input even when extraction works
3. **Simplicity** - Reuses existing generation and mapping pipeline
4. **Transparency** - `manuallyProvided` flag tracks data provenance
5. **UX** - Clear, simple interface that only shows when needed


