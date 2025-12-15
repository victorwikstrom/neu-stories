# Ingestion Pipeline Status Machine

## Canonical Status Flow

The ingestion pipeline follows a strict state machine with the following transitions:

```
QUEUED → FETCHING → EXTRACTING → READY_TO_GENERATE → GENERATING → SAVED
  ↓         ↓            ↓              ↓               ↓
FAILED    FAILED       FAILED        FAILED          FAILED
```

## Status Definitions

| Status | Description | Set By | Next Status |
|--------|-------------|--------|-------------|
| `QUEUED` | Job created, waiting to fetch URL | Job creation | `FETCHING` |
| `FETCHING` | Fetching HTML from URL | Fetch service | `EXTRACTING` or `FAILED` |
| `EXTRACTING` | Extracting title/text from HTML | Extractor service | `READY_TO_GENERATE` or `FAILED` |
| `EXTRACTED` | *(Deprecated)* Use `READY_TO_GENERATE` instead | - | - |
| `READY_TO_GENERATE` | Extraction complete, ready for LLM | Extractor service | `GENERATING` |
| `GENERATING` | Generating draft with LLM | Generate endpoint | `SAVED` or `FAILED` |
| `SAVED` | Draft generated and saved to DB | Generate endpoint | *(terminal)* |
| `FAILED` | Pipeline failed at any step | Any step | *(terminal)* |

## Service Responsibilities

### Fetch Service (`ingestion-fetcher.ts`)
- **Input**: Job with status `QUEUED` or `FETCHING`
- **Actions**:
  1. Set status to `FETCHING`
  2. Fetch URL with security protections (SSRF, timeout, size limits)
  3. Store raw HTML in `rawHtml` field
  4. Set status to `EXTRACTING`
  5. Auto-trigger extraction
- **Outputs**: Status `EXTRACTING` or `FAILED`

### Extract Service (`ingestion-extractor.ts`)
- **Input**: Job with status `EXTRACTING`
- **Actions**:
  1. Parse HTML with Cheerio
  2. Extract title (og:title → twitter:title → <title> → h1)
  3. Extract main text content
  4. Validate minimum content requirements
  5. Store in `extractedTitle` and `extractedText` fields
  6. Set `extractedAt` timestamp
  7. Set status to `READY_TO_GENERATE`
- **Outputs**: Status `READY_TO_GENERATE` or `FAILED`
- **Protections**:
  - 15-second extraction timeout
  - 2MB max HTML size
  - 100 char minimum text length

### Generate Endpoint (`/api/ingestion-jobs/[id]/generate`)
- **Input**: Job with status `EXTRACTED`, `READY_TO_GENERATE`, or `GENERATING`
- **Gating Rule**: 
  - MUST validate `extractedAt`, `extractedTitle`, and `extractedText` are all present and non-empty
  - If validation fails, return `409 Conflict` with error `NOT_READY`
  - ONLY set status to `GENERATING` after validation passes
- **Actions**:
  1. Validate extracted content exists (gating rule)
  2. Set status to `GENERATING`
  3. Call LLM with extracted content
  4. Validate LLM response against schema
  5. Map draft to Story format
  6. Save Story to database
  7. Set status to `SAVED` with `storyId` reference
- **Outputs**: Status `SAVED` or `FAILED`
- **Protections**:
  - Rate limiting (1 request per job per 5 seconds)
  - 45-second OpenAI timeout
  - Strict JSON schema validation

## Manual Fallback Paths

### Manual Entry (Paywalled Content)
```
QUEUED → (skip fetch/extract) → READY_TO_GENERATE → GENERATING → SAVED
```
- Used when URL is paywalled or requires authentication
- User provides title and text directly
- Job created with status `EXTRACTING` and `manuallyProvided=true`

### Regenerate (Retry Failed Generation)
```
SAVED/FAILED → READY_TO_GENERATE → GENERATING → SAVED
```
- Used to retry generation with different prompts or after fixing issues
- Requires existing `extractedTitle` and `extractedText`
- Resets status to `READY_TO_GENERATE` and calls generate endpoint

## Error Handling

All errors are prefixed with the step tag for easy identification:
- `[FETCH]` - URL fetching errors (network, SSRF, timeout, HTTP status)
- `[EXTRACT]` - Content extraction errors (parsing, validation, timeout)
- `[GENERATE]` - Draft generation errors (LLM, validation, timeout)

Error messages are stored in `errorMessage` field and are user-facing.

## Database Fields

### Status Tracking
- `status` - Current pipeline status (enum)
- `errorMessage` - User-facing error message if `FAILED`

### Timestamps
- `createdAt` - Job creation time
- `updatedAt` - Last update time (auto-updated by Prisma)
- `fetchedAt` - When fetch completed
- `extractedAt` - When extraction completed
- `generatedAt` - When generation completed

### Content Storage
- `rawHtml` - Raw HTML from fetch (cleared after extraction to save space)
- `extractedTitle` - Extracted article title
- `extractedText` - Extracted article text (max 50k chars)

### Metadata
- `httpStatus` - HTTP status code from fetch
- `contentType` - Content-Type header from fetch
- `manuallyProvided` - True if content was manually entered
- `storyId` - Reference to generated Story (when `SAVED`)

## Best Practices

1. **Always check status before processing** - Each service should validate the job is in the expected status
2. **Use atomic status transitions** - Update status in the same transaction as the work
3. **Store errors with step tags** - Prefix all error messages with `[STEP]` for debugging
4. **Validate before GENERATING** - The generate endpoint MUST validate extracted content before transitioning to GENERATING
5. **Use timeouts** - All external calls (fetch, LLM) must have timeouts
6. **Clear sensitive data** - Consider clearing `rawHtml` after extraction to save database space

