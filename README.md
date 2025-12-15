# Nuo Stories

A Next.js application for ingesting news articles and generating structured story drafts using AI.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- OpenAI API key

### Setup

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string (with pooling)
- `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
- `OPENAI_API_KEY` - Your OpenAI API key

3. **Run database migrations:**

```bash
npx prisma generate
npx prisma migrate deploy
```

4. **Start the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Architecture

### Ingestion Pipeline

The application uses a multi-step ingestion pipeline to process news articles:

1. **FETCH** - Fetch HTML from URL with security protections
2. **EXTRACT** - Extract title and text content from HTML
3. **GENERATE** - Generate structured draft using OpenAI
4. **SAVE** - Save story draft to database

See [INGESTION_STATUS_MACHINE.md](./INGESTION_STATUS_MACHINE.md) for detailed documentation.

### Key Components

- **API Routes** (`src/app/api/ingestion-jobs/`)
  - `POST /api/ingestion-jobs` - Create new ingestion job
  - `POST /api/ingestion-jobs/[id]/fetch` - Trigger fetch step
  - `POST /api/ingestion-jobs/[id]/extract` - Trigger extract step
  - `POST /api/ingestion-jobs/[id]/generate` - Trigger generate step
  - `POST /api/ingestion-jobs/[id]/regenerate` - Retry generation
  - `POST /api/ingestion-jobs/[id]/manual-extract` - Manual content entry

- **Services** (`src/server/services/`)
  - `ingestion-fetcher.ts` - URL fetching with SSRF protection
  - `ingestion-extractor.ts` - HTML content extraction
  - `ingestion-generator.ts` - AI draft generation
  - `draft-to-story-mapper.ts` - Draft to database mapping

- **Repositories** (`src/server/repositories/`)
  - `ingestionJobRepository.ts` - Ingestion job CRUD
  - `storyRepository.ts` - Story CRUD
  - `savedItemRepository.ts` - User saved items

## Database Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations to production
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Testing

### Manual Regression Checklist

After making changes to the ingestion pipeline, verify these scenarios:

#### Happy Path - Normal Article
1. Navigate to `/admin/add-article`
2. Enter a valid news article URL (e.g., from a major news site)
3. Click "Add Article"
4. **Expected**: Pipeline completes through all steps
   - Status: QUEUED → FETCHING → EXTRACTING → READY_TO_GENERATE → GENERATING → SAVED
   - Story draft is created with headline, summary, what_happened, and background
   - Source is saved as EXTERNAL type
   - No errors in console

#### Paywalled Content - Manual Entry
1. Navigate to `/admin/add-article`
2. Enter a paywalled URL
3. Click "Add Article"
4. **Expected**: Fetch may succeed but extraction might fail
5. Use "Manual Entry" to provide title and text
6. **Expected**: 
   - Job status goes to READY_TO_GENERATE
   - Generation completes successfully
   - `manuallyProvided` flag is set

#### Bad URL - Fetch Failure
1. Try to add an invalid URL (e.g., `http://localhost:9999/fake`)
2. **Expected**:
   - Status: QUEUED → FETCHING → FAILED
   - Error message starts with `[FETCH]`
   - Error describes the issue (e.g., "SSRF protection", "Connection refused")

#### Extraction Timeout
1. Try to add a URL with extremely large HTML (>2MB)
2. **Expected**:
   - Status: QUEUED → FETCHING → EXTRACTING → FAILED
   - Error message starts with `[EXTRACT]`
   - Error: "rawHtml too large" or "Extraction timed out"

#### Generation Timeout/Failure
1. Add a valid article and let it reach READY_TO_GENERATE
2. If OpenAI is down or slow, generation may timeout
3. **Expected**:
   - Status: GENERATING → FAILED
   - Error message starts with `[GENERATE]`
   - Can use "Regenerate" button to retry

#### Regenerate - Retry Failed Generation
1. Find a job with status FAILED or SAVED
2. Click "Regenerate" button
3. **Expected**:
   - Job status resets to READY_TO_GENERATE
   - Generation runs again
   - New story draft is created (or existing one is updated)

#### Rate Limiting
1. Rapidly click "Generate" multiple times on the same job
2. **Expected**:
   - First request succeeds
   - Subsequent requests return 429 with "Rate limit exceeded"
   - After 5 seconds, requests succeed again

### Unit Tests

Run existing tests:

```bash
npm test
```

Current test coverage:
- Text extraction (`src/lib/__tests__/text-extraction.test.ts`)
- Draft generation (`src/lib/__tests__/draft-generation.test.ts`)

## Project Structure

```
nuo-stories/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── admin/            # Admin UI pages
│   │   └── page.tsx          # Public homepage
│   ├── lib/
│   │   ├── prisma.ts         # Prisma client
│   │   ├── url-fetcher.ts    # URL fetching utility
│   │   └── url-validator.ts  # URL validation
│   └── server/
│       ├── repositories/     # Data access layer
│       └── services/         # Business logic
├── INGESTION_STATUS_MACHINE.md  # Pipeline documentation
└── README.md                 # This file
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
