# Ingestion Services

This directory contains services for the content ingestion pipeline.

## Pipeline Overview

The ingestion pipeline consists of these steps:
1. **QUEUED** → Initial state when job is created
2. **FETCHING** → URL is fetched with security protections
3. **EXTRACTING** → Title and text are extracted from HTML
4. **GENERATING** → AI generates structured Nuo draft
5. **SAVED** → Content is saved to database
6. **FAILED** → Error occurred at any step

## URL Fetching Service

The `ingestion-fetcher.ts` service handles the FETCHING step of the ingestion pipeline with comprehensive security protections.

### Features

#### 1. URL Validation
- **Protocol validation**: Only `http://` and `https://` protocols are allowed
- **Basic format checking**: URL must be well-formed
- Located in: `src/lib/url-validator.ts`

#### 2. SSRF Protection
The service protects against Server-Side Request Forgery (SSRF) attacks by:

- **Blocking private IP ranges**:
  - Loopback addresses (127.0.0.0/8, ::1)
  - Private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  - Link-local addresses (169.254.0.0/16, fe80::/10)
  - Unique local addresses (fc00::/7, fd00::/8)

- **Blocking dangerous hostnames**:
  - `localhost`
  - Cloud metadata services (169.254.169.254, metadata.google.internal)

- **DNS validation**: Resolves hostnames to IP addresses and validates they're not private

#### 3. Fetch Protections
- **Timeout limit**: 30 seconds (configurable)
- **Size limit**: 10 MB max response size (configurable)
- **Redirect following**: Up to 5 redirects (configurable)
- **User agent**: Identifies as `NuoStoriesBot/1.0`

### Usage

#### Fetch a single job

```typescript
import { fetchIngestionJob } from '@/server/services/ingestion-fetcher';

const result = await fetchIngestionJob(jobId);

if (result.success) {
  console.log('Job fetched successfully:', result.job);
  // Job is now in EXTRACTING status with rawHtml populated
} else {
  console.error('Fetch failed:', result.error);
  // Job is in FAILED status with errorMessage set
}
```

#### Process queued jobs (for background workers)

```typescript
import { processNextQueuedJob } from '@/server/services/ingestion-fetcher';

const result = await processNextQueuedJob();

if (result === null) {
  console.log('No queued jobs to process');
} else if (result.success) {
  console.log('Processed job:', result.job.id);
} else {
  console.error('Job failed:', result.error);
}
```

#### Via API endpoint

```bash
# Trigger fetch for a specific job
curl -X POST http://localhost:3000/api/ingestion-jobs/{jobId}/fetch
```

### Status Transitions

The fetch service manages these status transitions:

1. **QUEUED → FETCHING**: When fetch begins
2. **FETCHING → EXTRACTING**: On successful fetch (rawHtml stored)
3. **FETCHING → FAILED**: On error (errorMessage stored)

### Error Handling

Errors are categorized and stored with descriptive messages:

- **URL Validation Errors**: Invalid format, blocked protocols, private IPs
- **DNS Errors**: Resolution failures
- **Fetch Errors**: Timeout, network failures, HTTP errors
- **Size Limit Errors**: Response exceeds maximum size

### Database Fields Populated

On successful fetch:
- `rawHtml`: The complete HTML content
- `httpStatus`: HTTP response status code
- `contentType`: Content-Type header value
- `fetchedAt`: Timestamp of successful fetch
- `status`: Updated to EXTRACTING

On failed fetch:
- `errorMessage`: Detailed error description
- `httpStatus`: HTTP status if applicable
- `status`: Updated to FAILED

### Security Considerations

⚠️ **Important**: This service is designed to fetch content from untrusted URLs safely:

1. Never expose raw HTML directly to users without sanitization
2. Consider implementing rate limiting for fetch operations
3. Monitor for abuse patterns (repeated failures, suspicious URLs)
4. The DNS check happens before fetching, but be aware of DNS rebinding attacks
5. Size limits prevent memory exhaustion attacks
6. Timeout prevents resource starvation

### Testing

To manually test URL validation:

```typescript
import { validateUrl, safeValidateUrl } from '@/lib/url-validator';

// Throws on invalid URL
try {
  const url = validateUrl('http://localhost/admin');
} catch (error) {
  console.error('Validation failed:', error.message);
}

// Returns validation result
const result = safeValidateUrl('http://example.com');
if (result.valid) {
  console.log('Valid URL:', result.url);
} else {
  console.error('Invalid URL:', result.error);
}
```

To test fetching:

```typescript
import { fetchUrl } from '@/lib/url-fetcher';

const result = await fetchUrl('https://example.com', {
  timeoutMs: 10000,      // 10 seconds
  maxSizeBytes: 1048576, // 1 MB
});

console.log('Fetched:', result.size, 'bytes');
console.log('Content type:', result.contentType);
```

### Future Enhancements

Consider adding:
- [ ] Rate limiting per domain
- [ ] Caching layer to avoid re-fetching
- [ ] Webhook support for async processing
- [ ] Message queue integration (Redis, RabbitMQ, SQS)
- [ ] Retry logic with exponential backoff
- [ ] URL normalization and deduplication
- [ ] Content-Type validation (reject non-HTML)
- [ ] Robots.txt respect

---

## Text Extraction Service

The `ingestion-extractor.ts` service handles the EXTRACTING step of the ingestion pipeline, parsing HTML to extract clean title and text content.

### Features

#### 1. Title Extraction
Extracts title with the following precedence:
1. **Open Graph title** (`og:title` meta tag)
2. **Twitter title** (`twitter:title` meta tag)
3. **HTML title** (`<title>` tag)
4. **First H1** (first `<h1>` element)

#### 2. Text Extraction
- **Smart content detection**: Identifies main article content using common selectors
  - `<article>`, `<main>`, `[role="main"]`
  - `.article-content`, `.post-content`, `.entry-content`, `.content`, `.story-body`
- **Heuristic extraction**: Falls back to `<body>` text if no article container found
- **Element removal**: Strips scripts, styles, navigation, headers, footers, sidebars, ads

#### 3. Content Normalization
- **Whitespace normalization**: Collapses multiple spaces, normalizes line endings
- **Deduplication**: Removes repeated lines (common in navigation/footers)
- **Newline collapsing**: Limits consecutive newlines to maximum of 2
- **Validation**: Ensures minimum text length (default: 100 chars)

### Usage

#### Extract a single job

```typescript
import { extractIngestionJob } from '@/server/services/ingestion-extractor';

const result = await extractIngestionJob(jobId, {
  minTextLength: 100,
  maxTextLength: 1000000,
});

if (result.success) {
  console.log('Extracted:', result.job.extractedTitle);
  console.log('Text length:', result.job.extractedText?.length);
  // Job is now in GENERATING status
} else {
  console.error('Extraction failed:', result.error);
  // Job is in FAILED status with errorMessage set
}
```

#### Process jobs ready for extraction

```typescript
import { processNextExtractingJob } from '@/server/services/ingestion-extractor';

const result = await processNextExtractingJob();

if (result === null) {
  console.log('No jobs ready for extraction');
} else if (result.success) {
  console.log('Extracted job:', result.job.id);
} else {
  console.error('Job failed:', result.error);
}
```

#### Via API endpoint

```bash
# Trigger extraction for a specific job
curl -X POST http://localhost:3000/api/ingestion-jobs/{jobId}/extract
```

### Status Transitions

The extraction service manages these status transitions:

1. **EXTRACTING → GENERATING**: On successful extraction (title & text stored)
2. **EXTRACTING → FAILED**: On error (errorMessage stored)

### Error Handling

Errors are categorized and stored with descriptive messages:

- **Missing HTML**: Job has no `rawHtml` to extract from
- **No title found**: Could not extract title from any source
- **No text found**: Could not extract any text content
- **Text too short**: Extracted text below minimum length threshold
- **Text too long**: Extracted text exceeds maximum length
- **Parsing errors**: HTML parsing or processing failures

### Database Fields Populated

On successful extraction:
- `extractedTitle`: The extracted title
- `extractedText`: The cleaned and normalized text content
- `extractedAt`: Timestamp of successful extraction
- `status`: Updated to GENERATING

On failed extraction:
- `errorMessage`: Detailed error description
- `status`: Updated to FAILED

### Configuration

Default configuration:
- **Minimum text length**: 100 characters
- **Maximum text length**: 1,000,000 characters (1MB)

You can override these when calling `extractIngestionJob`:

```typescript
await extractIngestionJob(jobId, {
  minTextLength: 200,     // Require longer content
  maxTextLength: 500000,  // Limit to 500KB
});
```

### Testing

The extraction logic is comprehensively tested with various HTML fixtures.

Run tests:

```bash
npm test
```

Test fixtures include:
- Articles with Open Graph tags
- Articles with Twitter Card tags
- Simple blog posts
- Complex multi-section articles
- Articles with repeated navigation elements
- Minimal articles (edge case)

See `src/lib/__fixtures__/html-samples.ts` for all fixture examples.

### Best Practices

1. **Always validate extraction**: Check that both title and text were extracted
2. **Monitor text lengths**: Track typical content lengths to tune thresholds
3. **Review failed extractions**: Inspect HTML of failed jobs to improve selectors
4. **Handle edge cases**: Some pages may have unusual structures

### Future Enhancements

Consider adding:
- [ ] Language detection
- [ ] Author extraction
- [ ] Publication date extraction
- [ ] Image extraction (featured image, article images)
- [ ] Video/media detection
- [ ] Reading time estimation
- [ ] Keyword/tag extraction
- [ ] Content summarization
- [ ] Sentiment analysis
- [ ] Readability score
- [ ] Support for non-HTML content (PDF, etc.)
- [ ] Better handling of paywalls and JavaScript-rendered content

---

## Draft Generation Service

The `ingestion-generator.ts` service handles the GENERATING step of the ingestion pipeline, using an LLM to create a structured Nuo draft from extracted content.

### Features

#### 1. Versioned Prompt System
- **Current version**: `v1.0.0` (tracked via `PROMPT_VERSION` constant)
- **Bilingual prompts**: Swedish and English support
- **Strict guidelines**: Factual accuracy, conciseness, no hallucination
- **JSON-only output**: No markdown or extra formatting

#### 2. Structured Response Schema
The LLM returns a validated JSON structure:
```typescript
{
  headline: string;        // 10-200 chars
  short_summary: string;   // 50-500 chars
  what_happened: string[]; // 1-10 items, chronological facts
  background: string[];    // 0-10 items, contextual info
  evidence: Array<{        // Links claims to source text
    claim_path: string;    // e.g., "what_happened[0]"
    support: string;       // Quote from source
  }>;
}
```

#### 3. Response Validation
- **Zod schema validation**: Strict type checking and constraints
- **Automatic markdown stripping**: Handles ```json``` wrapped responses
- **Detailed error messages**: Clear validation failure reasons
- **JSON parsing with recovery**: Attempts to clean malformed responses

### Usage

#### Generate a draft for a job

```typescript
import { generateNuoDraft } from '@/server/services/ingestion-generator';

const result = await generateNuoDraft(
  job.extractedTitle!,
  job.extractedText!,
  {
    language: 'sv',
    temperature: 0.1,  // Low for factual accuracy
  }
);

if (result.success) {
  console.log('Draft:', result.draft);
  console.log('Version:', result.metadata.promptVersion);
  console.log('Model:', result.metadata.model);
  // Convert draft to Story and save to database
} else {
  console.error('Generation failed:', result.error);
  // Update job to FAILED status
}
```

#### Build prompts manually (for testing)

```typescript
import {
  buildSystemPrompt,
  buildUserPrompt,
  PROMPT_VERSION,
} from '@/server/services/ingestion-generator';

const systemPrompt = buildSystemPrompt('sv');
const userPrompt = buildUserPrompt(title, text);

// Use with your LLM client
const response = await llm.generate({ system: systemPrompt, user: userPrompt });
```

#### Validate LLM responses

```typescript
import { parseAndValidateLLMResponse } from '@/server/services/ingestion-generator';

const result = parseAndValidateLLMResponse(llmResponse);

if (result.success) {
  console.log('Valid draft:', result.data);
} else {
  console.error('Invalid response:', result.error);
}
```

#### Via API endpoint

```bash
# Generate draft for a specific job
curl -X POST http://localhost:3000/api/ingestion-jobs/{jobId}/generate
```

### Status Transitions

The generation service manages these status transitions:

1. **GENERATING → SAVED**: On successful draft generation
2. **GENERATING → FAILED**: On error (errorMessage stored)

### Error Handling

Errors are categorized and stored with descriptive messages:

- **Missing content**: Job has no `extractedTitle` or `extractedText`
- **LLM errors**: API failures, timeouts, rate limits
- **Parsing errors**: Invalid JSON, malformed response
- **Validation errors**: Response doesn't match schema (too short, missing fields, etc.)

### Database Fields Used

Input fields (read):
- `extractedTitle`: The article title
- `extractedText`: The article content

Output fields (written):
- `generatedAt`: Timestamp of successful generation
- `status`: Updated to SAVED or FAILED

The draft itself is saved as a Story record, not in the IngestionJob.

### Configuration

Default configuration:
```typescript
{
  model: 'gpt-4-turbo-preview',
  temperature: 0.1,      // Low for factual accuracy
  maxTokens: 2000,
  language: 'sv',        // Swedish by default
}
```

Override when calling:
```typescript
await generateNuoDraft(title, text, {
  model: 'gpt-4',
  temperature: 0.2,
  language: 'en',
});
```

### Prompt Constraints

The system enforces strict rules:

1. **Factual only**: Use ONLY facts from the provided text
2. **No hallucination**: If uncertain, omit rather than guess
3. **Concise**: Keep it brief, avoid repetition
4. **Evidence-based**: Every claim must have supporting evidence
5. **Swedish output**: Unless configured otherwise
6. **JSON format**: No markdown, no extra formatting

### Response Schema Details

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `headline` | string | 10-200 chars | Clear summary headline |
| `short_summary` | string | 50-500 chars | 2-3 sentence overview |
| `what_happened` | string[] | 1-10 items | Chronological facts |
| `background` | string[] | 0-10 items | Context & background |
| `evidence` | object[] | ≥1 item | Links claims to source |

Each evidence item:
- `claim_path`: JSON path like `"what_happened[0]"` or `"background[2]"`
- `support`: Short quote or reference from the source text

### Testing

Run tests:
```bash
npm test src/lib/__tests__/draft-generation.test.ts
```

Test coverage includes:
- Prompt version validation (semver format)
- System prompt generation (Swedish & English)
- User prompt building & truncation
- Schema validation for all fields
- Response parsing (JSON & markdown-wrapped)
- Error handling & validation failures

See `src/lib/__examples__/draft-generation.example.ts` for usage examples.

### LLM Integration

⚠️ **Note**: You need to integrate your LLM client.

The service has a placeholder where you should add your LLM call. Example with OpenAI:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: finalConfig.model,
  temperature: finalConfig.temperature,
  max_tokens: finalConfig.maxTokens,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
});

const llmResponse = response.choices[0]?.message?.content || '';
```

### Documentation

See comprehensive documentation:
- **Full guide**: `DRAFT_GENERATION.md`
- **Quick reference**: `PROMPT_REFERENCE.md`
- **Tests**: `src/lib/__tests__/draft-generation.test.ts`
- **Examples**: `src/lib/__examples__/draft-generation.example.ts`

### Best Practices

1. **Low temperature**: Use 0.1-0.2 for factual content
2. **Always validate**: Never skip schema validation
3. **Store metadata**: Save `promptVersion` and `modelName` with each draft
4. **Monitor failures**: Track validation errors to improve prompts
5. **Version prompts**: Increment `PROMPT_VERSION` on breaking changes
6. **Test thoroughly**: Use real articles to validate quality

### Prompt Evolution

When updating prompts:

1. Increment `PROMPT_VERSION` (use semantic versioning)
2. Update tests to match new schema
3. Document breaking changes
4. Consider backward compatibility
5. A/B test before deploying

### Future Enhancements

Consider adding:
- [ ] Multi-source draft generation (combine multiple articles)
- [ ] Custom prompt templates per source type
- [ ] Fact-checking integration
- [ ] Quote extraction and attribution
- [ ] Related story linking
- [ ] Automatic tagging/categorization
- [ ] Image suggestion based on content
- [ ] Summary length variants (short/medium/long)
- [ ] Tone adjustment (neutral/analytical/narrative)
- [ ] Translation support (generate in multiple languages)

