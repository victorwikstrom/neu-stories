# Nuo Draft Generation

This document describes the LLM-based draft generation system for Nuo stories.

## Overview

The draft generation service takes `extracted_title` and `extracted_text` from the ingestion pipeline and uses an LLM to generate a structured Nuo draft in JSON format.

## Prompt System

### Version

Current version: **v1.0.0** (defined in `PROMPT_VERSION` constant)

The prompt version is incremented when making breaking changes to:
- The system prompt structure
- The expected JSON schema
- The validation rules

### Prompt Components

1. **System Prompt**: Defines the AI's role and strict rules
   - Available in Swedish (`sv`) and English (`en`)
   - Contains JSON schema and examples
   - Emphasizes factual accuracy and brevity

2. **User Prompt**: Contains the extracted content
   - Format: `Rubrik: [title]\n\nText:\n[text]`
   - Automatically truncates long articles (>8000 chars)

## Response Schema

The LLM must return valid JSON matching this structure:

```json
{
  "headline": "string (10-200 chars)",
  "short_summary": "string (50-500 chars)",
  "what_happened": ["string", "string", ...],
  "background": ["string", "string", ...],
  "evidence": [
    {
      "claim_path": "what_happened[0]",
      "support": "quote from source"
    }
  ]
}
```

### Schema Validation Rules

#### `headline`
- Type: `string`
- Min length: 10 characters
- Max length: 200 characters
- Purpose: Clear, concise headline summarizing the story

#### `short_summary`
- Type: `string`
- Min length: 50 characters
- Max length: 500 characters
- Purpose: Brief 2-3 sentence summary of the entire story

#### `what_happened`
- Type: `array of strings`
- Min items: 1
- Max items: 10
- Purpose: Key facts in chronological order

#### `background`
- Type: `array of strings`
- Min items: 0
- Max items: 10
- Purpose: Contextual information needed to understand the story

#### `evidence`
- Type: `array of objects`
- Min items: 1
- Purpose: Links claims to source text
- Each evidence item:
  - `claim_path`: JSON path (e.g., `"what_happened[0]"`, `"background[1]"`)
  - `support`: Short quote or reference from source text

## Prompt Constraints

The system prompt enforces these rules:

1. **Factual Accuracy**: Use ONLY facts from the provided text
2. **Uncertainty Handling**: If uncertain, omit rather than guess
3. **Language**: Swedish by default (configurable to English)
4. **Conciseness**: Keep it brief, avoid repetition
5. **Format**: Return ONLY valid JSON, no markdown

## Usage

### Basic Generation

```typescript
import { generateNuoDraft } from '@/server/services/ingestion-generator';

const result = await generateNuoDraft(
  'Article Title',
  'Article text content...',
  {
    language: 'sv',
    temperature: 0.1, // Low for factual accuracy
  }
);

if (result.success) {
  console.log(result.draft);
  console.log('Generated with:', result.metadata.promptVersion);
} else {
  console.error(result.error);
}
```

### Manual Prompt Building

```typescript
import {
  buildSystemPrompt,
  buildUserPrompt,
  PROMPT_VERSION,
} from '@/server/services/ingestion-generator';

const systemPrompt = buildSystemPrompt('sv');
const userPrompt = buildUserPrompt(title, text);

// Use with your LLM client
const response = await llmClient.generate({
  system: systemPrompt,
  user: userPrompt,
  temperature: 0.1,
});
```

### Response Validation

```typescript
import { parseAndValidateLLMResponse } from '@/server/services/ingestion-generator';

const result = parseAndValidateLLMResponse(llmResponse);

if (result.success) {
  console.log('Valid draft:', result.data);
} else {
  console.error('Validation failed:', result.error);
}
```

## Integration with Pipeline

The draft generation fits into the ingestion pipeline at the GENERATING stage:

```
QUEUED → FETCHING → EXTRACTING → GENERATING → SAVED
                                      ↑
                                 (you are here)
```

### Pipeline Integration Example

```typescript
// 1. Get job with GENERATING status
const job = await getIngestionJobById(jobId);

// 2. Generate draft
const result = await generateNuoDraft(
  job.extractedTitle!,
  job.extractedText!
);

// 3. Handle result
if (result.success) {
  // Convert to Story format and save
  const story = await createStoryFromDraft(result.draft);
  
  // Update job status
  await updateIngestionJob({
    id: jobId,
    status: 'SAVED',
    generatedAt: result.metadata.generatedAt,
  });
} else {
  // Update job to FAILED
  await updateIngestionJob({
    id: jobId,
    status: 'FAILED',
    errorMessage: result.error,
  });
}
```

## LLM Integration

The service currently has a placeholder for LLM integration. You need to:

1. Choose your LLM provider (OpenAI, Anthropic, etc.)
2. Add the client library to `package.json`
3. Implement the call in `generateNuoDraft()`

### Example: OpenAI Integration

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In generateNuoDraft():
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
const parsed = parseAndValidateLLMResponse(llmResponse);
```

## Response Format Handling

The parser automatically handles different response formats:

### Plain JSON
```json
{"headline": "...", ...}
```

### Markdown-wrapped JSON
```markdown
```json
{"headline": "...", ...}
```
```

Both formats are automatically cleaned and validated.

## Error Handling

The service provides detailed error messages:

### Schema Validation Errors
```
Schema validation failed: headline: String must contain at least 10 character(s), what_happened: Array must contain at least 1 element(s)
```

### JSON Parsing Errors
```
Invalid JSON: Unexpected token } in JSON at position 42
```

### LLM Client Errors
```
LLM integration not yet implemented. Add your LLM client call here.
```

## Testing

Run tests with:

```bash
npm test src/lib/__tests__/draft-generation.test.ts
```

Test coverage includes:
- Prompt version validation
- System prompt generation (Swedish & English)
- User prompt building & truncation
- Schema validation (all fields)
- Response parsing (JSON & markdown)
- Error handling

## Schema Export

Export the schema as JSON for API documentation:

```typescript
import { getResponseSchemaAsJSON } from '@/server/services/ingestion-generator';

const schema = getResponseSchemaAsJSON();
console.log(JSON.stringify(schema, null, 2));
```

## Configuration Options

```typescript
interface GenerateConfig {
  model?: string;        // Default: 'gpt-4-turbo-preview'
  temperature?: number;  // Default: 0.1 (factual)
  maxTokens?: number;    // Default: 2000
  language?: 'sv' | 'en'; // Default: 'sv'
}
```

## Best Practices

1. **Low Temperature**: Use 0.1-0.2 for factual accuracy
2. **Validate Always**: Never skip response validation
3. **Store Version**: Save `promptVersion` and `model` with each draft
4. **Handle Errors**: Always check `result.success` before using draft
5. **Monitor Quality**: Track validation failures to improve prompts

## Prompt Evolution

When updating prompts:

1. Increment `PROMPT_VERSION` (use semver)
2. Update tests to match new schema
3. Document breaking changes
4. Consider migration for existing drafts
5. A/B test new prompts before deploying

## Files

- **Service**: `src/server/services/ingestion-generator.ts`
- **Tests**: `src/lib/__tests__/draft-generation.test.ts`
- **Examples**: `src/lib/__examples__/draft-generation.example.ts`
- **Documentation**: `DRAFT_GENERATION.md` (this file)

