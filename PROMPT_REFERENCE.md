# Nuo Draft Generation - Prompt Reference

Quick reference for the LLM prompts and expected output format.

## Prompt Version

**Current**: `v1.0.0`

## System Prompt (Swedish)

```
Du är en AI-assistent som hjälper till att strukturera nyhetstexter till Nuo-format.

Din uppgift är att:
1. Läsa rubriken och texten från en nyhetsartikel
2. Extrahera och strukturera informationen i ett väldefinierat JSON-format
3. Endast använda fakta som explicit finns i den givna texten
4. Hålla dig kort och koncis

VIKTIGA REGLER:
- Använd ENDAST fakta från den tillhandahållna texten
- Om du är osäker på något, hoppa över det istället för att gissa
- Skriv på svenska
- Var koncis och undvik upprepning
- Returnera ENDAST giltig JSON, ingen markdown eller annan formatering
- Varje påstående i "what_happened" och "background" ska ha motsvarande bevis i "evidence"

JSON-SCHEMA:
{
  "headline": "En tydlig rubrik som sammanfattar artikeln",
  "short_summary": "En kort sammanfattning (2-3 meningar) av hela artikeln",
  "what_happened": [
    "Första händelsen eller faktum",
    "Andra händelsen eller faktum",
    "..."
  ],
  "background": [
    "Relevant bakgrundsinformation",
    "Ytterligare kontext",
    "..."
  ],
  "evidence": [
    {
      "claim_path": "what_happened[0]",
      "support": "Citat eller hänvisning från källtexten som stödjer påståendet"
    },
    {
      "claim_path": "what_happened[1]",
      "support": "Citat eller hänvisning från källtexten"
    }
  ]
}

EXEMPEL PÅ claim_path:
- "what_happened[0]" - första elementet i what_happened
- "what_happened[1]" - andra elementet i what_happened
- "background[0]" - första elementet i background
- "short_summary" - sammanfattningen
```

## User Prompt Format

```
Rubrik: [EXTRACTED_TITLE]

Text:
[EXTRACTED_TEXT]

Generera nu ett strukturerat Nuo-draft i JSON-format baserat på ovanstående rubrik och text. Kom ihåg att endast använda fakta från texten och returnera giltig JSON.
```

## Expected Response Schema

### JSON Structure

```typescript
{
  headline: string;        // 10-200 chars
  short_summary: string;   // 50-500 chars
  what_happened: string[]; // 1-10 items
  background: string[];    // 0-10 items
  evidence: Array<{
    claim_path: string;    // e.g., "what_happened[0]"
    support: string;       // quote from source
  }>;                      // min 1 item
}
```

### Validation Rules

| Field | Type | Min | Max | Required |
|-------|------|-----|-----|----------|
| `headline` | string | 10 chars | 200 chars | ✓ |
| `short_summary` | string | 50 chars | 500 chars | ✓ |
| `what_happened` | array | 1 item | 10 items | ✓ |
| `background` | array | 0 items | 10 items | ✓ |
| `evidence` | array | 1 item | - | ✓ |

## Real-World Example

### Input

**Title**: "Riksdagen antar ny klimatlag"

**Text**:
```
Riksdagen röstade igår med bred majoritet för att anta den nya klimatlagen.
Lagen innebär skärpta utsläppsmål för Sverige fram till 2030.

Miljöminister Anna Svensson kommenterade beslutet: "Detta är ett historiskt 
steg för Sveriges klimatarbete. Vi sätter nu tydliga mål som industrin kan 
planera efter."

Lagen träder i kraft den 1 januari nästa år och inkluderar bindande mål för 
minskning av växthusgaser med 60 procent jämfört med 1990 års nivåer.

Näringslivets organisationer har uttryckt både stöd och oro. "Vi stödjer målen 
men behöver tydligare vägledning om hur vi ska nå dit," säger företrädare för 
Svenskt Näringsliv.
```

### Expected Output

```json
{
  "headline": "Riksdagen antar ny klimatlag med skärpta utsläppsmål till 2030",
  "short_summary": "Riksdagen röstade med bred majoritet för en ny klimatlag som sätter bindande mål för Sverige att minska växthusgaser med 60 procent till 2030 jämfört med 1990 års nivåer. Lagen träder i kraft nästa år.",
  "what_happened": [
    "Riksdagen röstade med bred majoritet för den nya klimatlagen",
    "Lagen sätter bindande mål om 60 procent minskning av växthusgaser jämfört med 1990",
    "Lagen träder i kraft den 1 januari nästa år",
    "Miljöminister Anna Svensson kallade beslutet ett historiskt steg"
  ],
  "background": [
    "Lagen innebär skärpta utsläppsmål för Sverige fram till 2030",
    "Näringslivet har uttryckt både stöd och oro för implementeringen"
  ],
  "evidence": [
    {
      "claim_path": "what_happened[0]",
      "support": "Riksdagen röstade igår med bred majoritet för att anta den nya klimatlagen"
    },
    {
      "claim_path": "what_happened[1]",
      "support": "bindande mål för minskning av växthusgaser med 60 procent jämfört med 1990 års nivåer"
    },
    {
      "claim_path": "what_happened[2]",
      "support": "Lagen träder i kraft den 1 januari nästa år"
    },
    {
      "claim_path": "what_happened[3]",
      "support": "Detta är ett historiskt steg för Sveriges klimatarbete"
    },
    {
      "claim_path": "background[0]",
      "support": "Lagen innebär skärpta utsläppsmål för Sverige fram till 2030"
    },
    {
      "claim_path": "background[1]",
      "support": "Näringslivets organisationer har uttryckt både stöd och oro"
    }
  ]
}
```

## Common Mistakes to Avoid

### ❌ Incorrect

```json
{
  "headline": "Ny lag",  // Too short (< 10 chars)
  "short_summary": "En ny lag antogs.",  // Too short (< 50 chars)
  "what_happened": [],  // Empty array (min 1 required)
  "evidence": []  // Empty array (min 1 required)
}
```

### ❌ Incorrect (adding unverified info)

```json
{
  "headline": "Riksdagen antar kontroversiell klimatlag",
  "what_happened": [
    "Lagen kommer att kosta industrin miljarder"  // Not in source text!
  ]
}
```

### ❌ Incorrect (wrong claim_path format)

```json
{
  "evidence": [
    {
      "claim_path": "headline",  // Should reference what_happened or background
      "support": "..."
    }
  ]
}
```

### ✓ Correct

```json
{
  "headline": "Riksdagen antar ny klimatlag med skärpta utsläppsmål",
  "short_summary": "Riksdagen röstade med bred majoritet för en ny klimatlag som sätter bindande mål för Sverige att minska växthusgaser med 60 procent till 2030.",
  "what_happened": [
    "Riksdagen röstade med bred majoritet för den nya klimatlagen"
  ],
  "background": [
    "Lagen innebär skärpta utsläppsmål för Sverige fram till 2030"
  ],
  "evidence": [
    {
      "claim_path": "what_happened[0]",
      "support": "Riksdagen röstade igår med bred majoritet för att anta den nya klimatlagen"
    },
    {
      "claim_path": "background[0]",
      "support": "Lagen innebär skärpta utsläppsmål för Sverige fram till 2030"
    }
  ]
}
```

## Testing Your Implementation

### 1. Basic Validation

```bash
npm test src/lib/__tests__/draft-generation.test.ts
```

### 2. Manual Testing

```typescript
import { parseAndValidateLLMResponse } from '@/server/services/ingestion-generator';

const testResponse = '{"headline": "..."}';
const result = parseAndValidateLLMResponse(testResponse);

if (result.success) {
  console.log('✓ Valid');
} else {
  console.log('✗ Invalid:', result.error);
}
```

### 3. Prompt Testing

Test your prompts directly with the LLM:

```typescript
import { buildSystemPrompt, buildUserPrompt } from '@/server/services/ingestion-generator';

console.log(buildSystemPrompt('sv'));
console.log(buildUserPrompt('Test Title', 'Test text...'));
```

## Integration Checklist

- [ ] Install LLM client library (e.g., `openai`)
- [ ] Add API key to environment variables
- [ ] Implement LLM call in `generateNuoDraft()`
- [ ] Test with real articles
- [ ] Monitor validation failures
- [ ] Store `promptVersion` with each draft
- [ ] Set up error tracking
- [ ] Configure temperature (0.1-0.2 recommended)

## Quick Start

1. **Import the service**:
   ```typescript
   import { generateNuoDraft } from '@/server/services/ingestion-generator';
   ```

2. **Generate a draft**:
   ```typescript
   const result = await generateNuoDraft(title, text);
   ```

3. **Check the result**:
   ```typescript
   if (result.success) {
     console.log(result.draft.headline);
     console.log('Version:', result.metadata.promptVersion);
   }
   ```

## API Reference

See `DRAFT_GENERATION.md` for complete API documentation.

## Support

For issues or questions:
1. Check tests: `src/lib/__tests__/draft-generation.test.ts`
2. Review examples: `src/lib/__examples__/draft-generation.example.ts`
3. Read full docs: `DRAFT_GENERATION.md`

