# Nuo Draft Generation - Quick Reference

## 📁 Files Created

```
src/
├── server/services/
│   └── ingestion-generator.ts          # Core service (332 lines)
├── app/api/ingestion-jobs/[id]/
│   └── generate/route.ts               # API endpoint (114 lines)
└── lib/
    ├── __tests__/
    │   └── draft-generation.test.ts    # Tests (320 lines)
    └── __examples__/
        ├── draft-generation.example.ts # Usage examples (275 lines)
        └── draft-to-story-mapper.example.ts # Story mapping (285 lines)

docs/
├── DRAFT_GENERATION.md                 # Complete guide
├── PROMPT_REFERENCE.md                 # Quick reference
├── DRAFT_GENERATION_SUMMARY.md         # Implementation summary
└── PROMPT_SYSTEM.md                    # This file
```

## 🚀 Quick Start

### 1. Generate a Draft

```typescript
import { generateNuoDraft } from '@/server/services/ingestion-generator';

const result = await generateNuoDraft(title, text, {
  language: 'sv',
  temperature: 0.1,
});

if (result.success) {
  console.log(result.draft.headline);
}
```

### 2. Validate Response

```typescript
import { parseAndValidateLLMResponse } from '@/server/services/ingestion-generator';

const result = parseAndValidateLLMResponse(llmResponse);
// Automatically validates and strips markdown
```

### 3. Map to Story

```typescript
import { mapDraftToStory } from '@/lib/__examples__/draft-to-story-mapper.example';

const story = mapDraftToStory(draft, sourceUrl, {
  promptVersion: 'v1.0.0',
  modelName: 'gpt-4',
  generatedAt: new Date(),
});
```

## 📋 Response Schema

```json
{
  "headline": "string (10-200 chars)",
  "short_summary": "string (50-500 chars)",
  "what_happened": ["string", ...],  // 1-10 items
  "background": ["string", ...],     // 0-10 items
  "evidence": [
    {
      "claim_path": "what_happened[0]",
      "support": "quote from source"
    }
  ]
}
```

## 🔒 Prompt Constraints

| Rule | Description |
|------|-------------|
| **Factual only** | Use ONLY facts from provided text |
| **No guessing** | Omit if uncertain |
| **Evidence required** | Every claim needs supporting quote |
| **Swedish default** | Configurable to English |
| **JSON only** | No markdown or formatting |
| **Concise** | Brief, no repetition |

## ⚙️ Configuration

```typescript
{
  model: 'gpt-4-turbo-preview',  // LLM model
  temperature: 0.1,               // 0.1-0.2 for factual
  maxTokens: 2000,                // Response limit
  language: 'sv' | 'en',          // Output language
}
```

## 🧪 Testing

```bash
# Run all tests
npm test src/lib/__tests__/draft-generation.test.ts

# Run specific test
npm test -- --testNamePattern="Schema Validation"

# View examples
ts-node src/lib/__examples__/draft-generation.example.ts
```

## 🔌 API Endpoints

```bash
# Generate draft
POST /api/ingestion-jobs/{id}/generate

# Full pipeline
POST /api/ingestion-jobs              # Create job
POST /api/ingestion-jobs/{id}/fetch   # Fetch HTML
POST /api/ingestion-jobs/{id}/extract # Extract text
POST /api/ingestion-jobs/{id}/generate # Generate draft ⭐
```

## 🎯 Key Functions

| Function | Purpose |
|----------|---------|
| `generateNuoDraft()` | Main generation function |
| `buildSystemPrompt()` | Get system prompt (sv/en) |
| `buildUserPrompt()` | Build user prompt with content |
| `parseAndValidateLLMResponse()` | Validate LLM output |
| `mapDraftToStory()` | Convert draft to Story schema |
| `generateSlug()` | Create URL slug from headline |

## 📊 Validation Rules

| Field | Min | Max | Required |
|-------|-----|-----|----------|
| headline | 10 chars | 200 chars | ✅ |
| short_summary | 50 chars | 500 chars | ✅ |
| what_happened | 1 item | 10 items | ✅ |
| background | 0 items | 10 items | ✅ |
| evidence | 1 item | - | ✅ |

## 🐛 Common Issues

### Issue: TypeScript errors on `extractedTitle`

**Fix**: Restart TypeScript server or run `npx prisma generate`

### Issue: Validation fails

**Fix**: Check `result.error` for detailed message

### Issue: LLM returns markdown

**Fix**: Already handled automatically!

## 📚 Documentation

| File | Purpose |
|------|---------|
| `DRAFT_GENERATION.md` | Complete guide |
| `PROMPT_REFERENCE.md` | Quick reference + examples |
| `DRAFT_GENERATION_SUMMARY.md` | Implementation overview |
| `PROMPT_SYSTEM.md` | This quick reference |

## 🔄 Pipeline Flow

```
┌─────────┐
│ QUEUED  │
└────┬────┘
     │ POST /api/ingestion-jobs/{id}/fetch
     ▼
┌─────────┐
│FETCHING │ → rawHtml stored
└────┬────┘
     │ POST /api/ingestion-jobs/{id}/extract
     ▼
┌──────────┐
│EXTRACTING│ → extractedTitle + extractedText
└────┬─────┘
     │ POST /api/ingestion-jobs/{id}/generate ⭐ NEW
     ▼
┌───────────┐
│GENERATING │ → Draft generated
└────┬──────┘
     │ Story saved to database
     ▼
┌────────┐
│ SAVED  │
└────────┘
```

## 🎨 Example Prompt

**System Prompt (Swedish)**:
```
Du är en AI-assistent som hjälper till att strukturera nyhetstexter...

VIKTIGA REGLER:
- Använd ENDAST fakta från den tillhandahållna texten
- Om du är osäker, hoppa över istället för att gissa
- Returnera ENDAST giltig JSON
```

**User Prompt**:
```
Rubrik: Riksdagen antar ny klimatlag

Text:
Riksdagen röstade igår...

Generera nu ett strukturerat Nuo-draft i JSON-format...
```

## ✅ Success Checklist

- [x] Service implemented (`ingestion-generator.ts`)
- [x] API endpoint created (`/generate/route.ts`)
- [x] Tests written (320 lines)
- [x] Examples provided (2 files)
- [x] Documentation complete (4 files)
- [x] Schema validation working
- [x] Bilingual support (sv/en)
- [x] Error handling comprehensive
- [ ] **TODO**: Integrate LLM client (OpenAI/Anthropic/etc.)
- [ ] **TODO**: Test with real articles
- [ ] **TODO**: Deploy to production

## 🔗 Next Steps

1. **Install LLM client**: `npm install openai`
2. **Add API key**: Update `.env` with `OPENAI_API_KEY`
3. **Integrate**: Update `ingestion-generator.ts` around line 245
4. **Test**: Run with real articles
5. **Monitor**: Track validation failures
6. **Iterate**: Improve prompts based on results

## 💡 Tips

- Use low temperature (0.1) for factual content
- Store `promptVersion` with each draft
- Monitor validation failures to improve prompts
- A/B test new prompts before deploying
- Keep prompts concise and clear
- Validate every response, no exceptions

## 📞 Support

- Tests: `src/lib/__tests__/draft-generation.test.ts`
- Examples: `src/lib/__examples__/`
- Full docs: `DRAFT_GENERATION.md`
- Reference: `PROMPT_REFERENCE.md`

---

**Version**: v1.0.0  
**Status**: ✅ Ready for LLM integration  
**Language**: Swedish (default), English (supported)

