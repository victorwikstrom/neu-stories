# Text Extraction - Quick Start Guide

## What Was Implemented

A complete text extraction step for the ingestion pipeline that:
- ✅ Extracts titles with smart precedence (og:title → twitter:title → title → h1)
- ✅ Extracts clean article text (removes nav, scripts, ads, etc.)
- ✅ Normalizes whitespace and removes duplicate lines
- ✅ Validates minimum content length (100 chars by default)
- ✅ Updates job status from EXTRACTING → GENERATING
- ✅ Includes comprehensive tests (37 tests, all passing)
- ✅ Provides HTML fixtures for testing

## Quick Usage

### 1. Via API

```bash
# After fetching a job, extract content:
curl -X POST http://localhost:3000/api/ingestion-jobs/{jobId}/extract
```

### 2. Programmatically

```typescript
import { extractIngestionJob } from '@/server/services/ingestion-extractor';

const result = await extractIngestionJob(jobId);

if (result.success) {
  console.log('Title:', result.job.extractedTitle);
  console.log('Text:', result.job.extractedText?.substring(0, 100));
}
```

### 3. Complete Pipeline Example

```typescript
import { createIngestionJob } from '@/server/repositories/ingestionJobRepository';
import { fetchIngestionJob } from '@/server/services/ingestion-fetcher';
import { extractIngestionJob } from '@/server/services/ingestion-extractor';

// 1. Create job
const job = await createIngestionJob({ url: 'https://example.com/article' });

// 2. Fetch HTML
const fetchResult = await fetchIngestionJob(job.id);

// 3. Extract content
const extractResult = await extractIngestionJob(fetchResult.job.id);

// 4. Ready for AI generation!
console.log('Title:', extractResult.job.extractedTitle);
console.log('Ready for generation:', extractResult.job.status === 'GENERATING');
```

## Run Tests

```bash
npm test
```

All 37 tests should pass.

## Database Changes

Two new fields on `IngestionJob`:
- `extractedTitle` (String?) - The extracted title
- `extractedText` (String?) - The cleaned article text

Migration: `20251212170000_add_extracted_title_and_text`

## Key Files

- **Service**: `src/server/services/ingestion-extractor.ts`
- **API**: `src/app/api/ingestion-jobs/[id]/extract/route.ts`
- **Tests**: `src/lib/__tests__/text-extraction.test.ts`
- **Fixtures**: `src/lib/__fixtures__/html-samples.ts`
- **Examples**: `src/lib/__examples__/ingestion-pipeline.example.ts`
- **Docs**: `src/server/services/README.md`

## Title Extraction Precedence

1. Open Graph (`<meta property="og:title">`)
2. Twitter Card (`<meta name="twitter:title">`)
3. HTML Title (`<title>`)
4. First H1 (`<h1>`)

## Text Extraction Features

**Smart Detection:**
- Looks for `<article>`, `<main>`, `[role="main"]`
- Tries `.article-content`, `.post-content`, `.entry-content`, etc.
- Falls back to `<body>` if no article container found

**Cleanup:**
- Removes: scripts, styles, nav, headers, footers, ads
- Normalizes whitespace
- Removes duplicate lines
- Collapses multiple newlines

## Configuration

```typescript
await extractIngestionJob(jobId, {
  minTextLength: 100,      // Default: 100 chars
  maxTextLength: 1000000,  // Default: 1MB
});
```

## Status Flow

```
EXTRACTING → GENERATING (success)
EXTRACTING → FAILED (error)
```

## Next Steps

The extraction step is complete. Next, implement the GENERATING step to:
1. Take `extractedTitle` and `extractedText`
2. Generate AI content (story, sections, etc.)
3. Update status to SAVED

## Dependencies Added

```json
{
  "dependencies": {
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "@types/cheerio": "^0.22.35"
  }
}
```

## Full Documentation

See `EXTRACTION_IMPLEMENTATION.md` for complete implementation details.

