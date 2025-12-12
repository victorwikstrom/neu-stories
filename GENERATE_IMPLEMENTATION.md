# Draft Generation Pipeline Implementation

This document describes the complete implementation of the "generate draft" pipeline step.

## Overview

The generate draft pipeline takes extracted content from an article and uses OpenAI's LLM to generate a structured Nuo story draft, which is then saved to the database.

## Implementation Components

### 1. OpenAI Integration

**File**: `src/server/services/ingestion-generator.ts`

- Integrated OpenAI SDK for LLM calls
- Uses `gpt-4-turbo-preview` model by default
- Configured with low temperature (0.1) for factual accuracy
- Returns structured JSON responses validated against Zod schema

**Environment Variable Required**:
```bash
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Draft to Story Mapper

**File**: `src/server/services/draft-to-story-mapper.ts`

Maps LLM response to database schema:
- Generates URL-friendly slugs (with timestamp for uniqueness)
- Creates sections from `what_happened` and `background` arrays
- Creates a Source record with `type="external"` and the original URL
- Extracts domain and generates source labels automatically
- Preserves AI provenance (model_name, prompt_version, generated_at)

### 3. Database Schema Updates

**Changes**:
- Added `storyId` field to `IngestionJob` model
- Added relation between `IngestionJob` and `Story`
- Updated repository to support `storyId` in update operations

**Migration**: Applied via `npx prisma db push`

### 4. Generate Route

**File**: `src/app/api/ingestion-jobs/[id]/generate/route.ts`

Complete pipeline implementation:
1. Validates job status is `GENERATING`
2. Validates extracted content exists
3. Calls LLM to generate draft
4. Validates response against Zod schema
5. Maps draft to Story format
6. Saves Story + Sections + Source to database
7. Updates IngestionJob with `storyId` and status `SAVED`
8. Returns story data and metadata

**Error Handling**:
- Schema validation failures → job marked `FAILED` with detailed error
- LLM errors → job marked `FAILED` with error message
- Missing extracted content → job marked `FAILED`

## API Usage

### Endpoint

```
POST /api/ingestion-jobs/[id]/generate
```

### Success Response

```json
{
  "success": true,
  "story": {
    "id": "clx...",
    "slug": "riksdagen-antar-ny-klimatlag-m2x7b",
    "headline": "Riksdagen antar ny klimatlag med skärpta utsläppsmål",
    "summary": "Riksdagen röstade med bred majoritet...",
    "status": "draft",
    "sections": [...],
    "primarySources": [...],
    "promptVersion": "v1.0.0",
    "modelName": "gpt-4-turbo-preview",
    "generatedAt": "2025-12-12T..."
  },
  "job": {
    "id": "clx...",
    "status": "SAVED",
    "storyId": "clx...",
    "generatedAt": "2025-12-12T..."
  },
  "metadata": {
    "promptVersion": "v1.0.0",
    "model": "gpt-4-turbo-preview",
    "generatedAt": "2025-12-12T..."
  }
}
```

### Error Response

```json
{
  "error": "Schema validation failed: headline: String must contain at least 10 character(s)",
  "job": {
    "id": "clx...",
    "status": "FAILED",
    "errorMessage": "Schema validation failed..."
  }
}
```

## Testing the Pipeline

### Manual Test

1. **Set up environment**:
   ```bash
   cp env.example .env
   # Add your OPENAI_API_KEY
   ```

2. **Create an ingestion job** (via your admin interface or API):
   ```bash
   POST /api/ingestion-jobs
   {
     "url": "https://example.com/article"
   }
   ```

3. **Run the fetch step**:
   ```bash
   POST /api/ingestion-jobs/[id]/fetch
   ```

4. **Run the extract step**:
   ```bash
   POST /api/ingestion-jobs/[id]/extract
   ```

5. **Run the generate step**:
   ```bash
   POST /api/ingestion-jobs/[id]/generate
   ```

6. **Verify the result**:
   ```bash
   GET /api/stories/[slug]
   ```

### Programmatic Test

```typescript
import { generateNuoDraft } from '@/server/services/ingestion-generator';
import { mapDraftToStory } from '@/server/services/draft-to-story-mapper';

const title = 'Test Article Title';
const text = 'Article content with facts and information...';

// Generate draft
const result = await generateNuoDraft(title, text);

if (result.success && result.draft) {
  console.log('✓ Draft generated successfully');
  
  // Map to story format
  const storyInput = mapDraftToStory(
    result.draft,
    'https://example.com/article',
    result.metadata
  );
  
  console.log('✓ Story input created:', storyInput);
} else {
  console.error('✗ Generation failed:', result.error);
}
```

## Data Flow

```
IngestionJob (GENERATING)
  ↓ extractedTitle + extractedText
OpenAI LLM
  ↓ JSON response
Zod Validation
  ↓ NuoDraftResponse
Draft Mapper
  ↓ StoryDraftInput
Database Transaction:
  - Create/Update Story (status=DRAFT)
  - Create Sections (what_happened + background)
  - Create/Find Source (type=external, url=original)
  - Link Story ↔ Source
  ↓
Update IngestionJob (status=SAVED, storyId)
```

## AI Provenance Tracking

Every generated story stores:
- `promptVersion`: Current prompt version used (e.g., "v1.0.0")
- `modelName`: LLM model used (e.g., "gpt-4-turbo-preview")
- `generatedAt`: Timestamp of generation

This enables:
- Tracking prompt evolution over time
- A/B testing different prompt versions
- Quality analysis per model/version
- Regenerating stories when prompts improve

## Configuration

Default configuration in `ingestion-generator.ts`:

```typescript
{
  model: 'gpt-4-turbo-preview',
  temperature: 0.1,  // Low for factual accuracy
  maxTokens: 2000,
  language: 'sv',    // Swedish by default
}
```

Override per request:

```typescript
await generateNuoDraft(title, text, {
  language: 'en',
  temperature: 0.2,
  model: 'gpt-4-turbo-preview',
});
```

## Error Handling

The pipeline handles these error cases:

1. **Missing API Key**: Throws error immediately
2. **Empty LLM Response**: Returns error, marks job failed
3. **Invalid JSON**: Parser catches and returns detailed error
4. **Schema Validation Failure**: Returns Zod validation errors, marks job failed
5. **Database Errors**: Caught in route handler, marks job failed
6. **Network Errors**: Caught by OpenAI client, marks job failed

All errors are:
- Logged to console
- Stored in `IngestionJob.errorMessage`
- Returned in API response with appropriate HTTP status

## Files Modified/Created

### Created
- `src/server/services/draft-to-story-mapper.ts` - Draft to Story mapping logic

### Modified
- `src/server/services/ingestion-generator.ts` - Added OpenAI integration
- `src/app/api/ingestion-jobs/[id]/generate/route.ts` - Complete pipeline implementation
- `src/server/repositories/ingestionJobRepository.ts` - Added storyId support
- `prisma/schema.prisma` - Added storyId to IngestionJob, relation to Story
- `env.example` - Added OPENAI_API_KEY
- `package.json` - Added openai dependency

## Next Steps

To use this implementation:

1. Set `OPENAI_API_KEY` in your `.env` file
2. Ensure your database is up to date (`npx prisma db push`)
3. Create an ingestion job through your admin interface
4. Run the pipeline: fetch → extract → **generate**
5. View the generated story in draft status

The story will be created with:
- Status: `DRAFT` ✓
- One external source ✓
- AI provenance metadata ✓
- Linked to IngestionJob via `storyId` ✓

## Validation

The LLM response is validated against this schema:

```typescript
{
  headline: string (10-200 chars),
  short_summary: string (50-500 chars),
  what_happened: string[] (1-10 items),
  background: string[] (0-10 items),
  evidence: EvidenceItem[] (min 1 item)
}
```

If validation fails, the job is marked `FAILED` with a detailed error message showing which fields failed validation.

