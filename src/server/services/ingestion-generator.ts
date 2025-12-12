/**
 * Ingestion generator service
 * 
 * Handles the GENERATING step of the ingestion pipeline:
 * 1. Takes extracted_title + extracted_text
 * 2. Sends to LLM with strict prompt
 * 3. Validates JSON response against schema
 * 4. Returns structured Nuo draft
 */

import { z } from 'zod';
import OpenAI from 'openai';

/**
 * Current prompt version
 * Increment this when making breaking changes to the prompt structure
 */
export const PROMPT_VERSION = 'v1.0.0';

/**
 * Evidence item linking claims to source text
 */
export const EvidenceItemSchema = z.object({
  claim_path: z.string().describe('JSON path to the claim, e.g., "what_happened[0]" or "background[1]"'),
  support: z.string().describe('Short quote or pointer from the source text supporting this claim'),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/**
 * LLM response schema for Nuo draft generation
 * This is the strict JSON structure the LLM must return
 */
export const NuoDraftResponseSchema = z.object({
  headline: z.string()
    .min(10)
    .max(200)
    .describe('A clear, concise headline summarizing the story'),
  
  short_summary: z.string()
    .min(50)
    .max(500)
    .describe('A brief summary (2-3 sentences) of the entire story'),
  
  what_happened: z.array(z.string())
    .min(1)
    .max(10)
    .describe('Array of key facts describing what happened, in chronological order'),
  
  background: z.array(z.string())
    .min(0)
    .max(10)
    .describe('Array of contextual information needed to understand the story'),
  
  evidence: z.array(EvidenceItemSchema)
    .min(1)
    .describe('Evidence linking each claim to the source text'),
});

export type NuoDraftResponse = z.infer<typeof NuoDraftResponseSchema>;

/**
 * Configuration for draft generation
 */
export interface GenerateConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  language?: 'sv' | 'en';
}

const DEFAULT_CONFIG: Required<GenerateConfig> = {
  model: 'gpt-4-turbo-preview',
  temperature: 0.1, // Low temperature for factual accuracy
  maxTokens: 2000,
  language: 'sv',
};

/**
 * Initialize OpenAI client
 */
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Builds the system prompt for Nuo draft generation
 */
export function buildSystemPrompt(language: 'sv' | 'en'): string {
  if (language === 'sv') {
    return `Du är en AI-assistent som hjälper till att strukturera nyhetstexter till Nuo-format.

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
- "short_summary" - sammanfattningen`;
  }

  // English version
  return `You are an AI assistant that helps structure news articles into Nuo format.

Your task is to:
1. Read the headline and text from a news article
2. Extract and structure the information into a well-defined JSON format
3. Only use facts explicitly present in the given text
4. Keep it concise and brief

IMPORTANT RULES:
- Use ONLY facts from the provided text
- If uncertain about something, omit it rather than guess
- Write in English
- Be concise and avoid repetition
- Return ONLY valid JSON, no markdown or other formatting
- Each claim in "what_happened" and "background" should have corresponding evidence in "evidence"

JSON SCHEMA:
{
  "headline": "A clear headline summarizing the article",
  "short_summary": "A brief summary (2-3 sentences) of the entire article",
  "what_happened": [
    "First event or fact",
    "Second event or fact",
    "..."
  ],
  "background": [
    "Relevant background information",
    "Additional context",
    "..."
  ],
  "evidence": [
    {
      "claim_path": "what_happened[0]",
      "support": "Quote or reference from source text supporting this claim"
    },
    {
      "claim_path": "what_happened[1]",
      "support": "Quote or reference from source text"
    }
  ]
}

EXAMPLES OF claim_path:
- "what_happened[0]" - first element in what_happened
- "what_happened[1]" - second element in what_happened
- "background[0]" - first element in background
- "short_summary" - the summary`;
}

/**
 * Builds the user prompt with the extracted content
 */
export function buildUserPrompt(title: string, text: string): string {
  // Truncate text if too long (keep first ~8000 chars to stay within token limits)
  const maxTextLength = 8000;
  const truncatedText = text.length > maxTextLength
    ? text.substring(0, maxTextLength) + '\n\n[Texten har trunkerats...]'
    : text;

  return `Rubrik: ${title}

Text:
${truncatedText}

Generera nu ett strukturerat Nuo-draft i JSON-format baserat på ovanstående rubrik och text. Kom ihåg att endast använda fakta från texten och returnera giltig JSON.`;
}

/**
 * Validates and parses the LLM response
 * Strips markdown code blocks if present and validates against schema
 */
export function parseAndValidateLLMResponse(response: string): {
  success: boolean;
  data?: NuoDraftResponse;
  error?: string;
} {
  try {
    // Strip markdown code blocks if present
    let cleanedResponse = response.trim();
    
    // Remove ```json and ``` if present
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '');
    }

    // Parse JSON
    const parsed = JSON.parse(cleanedResponse);

    // Validate against schema
    const validated = NuoDraftResponseSchema.parse(parsed);

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Schema validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      };
    }
    
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `Invalid JSON: ${error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

/**
 * Generates a Nuo draft from extracted title and text
 * 
 * This function:
 * 1. Builds the prompt with version
 * 2. Calls the LLM (placeholder - you'll need to integrate your LLM client)
 * 3. Validates the response
 * 4. Returns structured draft
 * 
 * @param title - The extracted title
 * @param text - The extracted text
 * @param config - Optional generation configuration
 * @returns The validated Nuo draft
 */
export async function generateNuoDraft(
  title: string,
  text: string,
  config?: GenerateConfig
): Promise<{
  success: boolean;
  draft?: NuoDraftResponse;
  error?: string;
  metadata: {
    promptVersion: string;
    model: string;
    generatedAt: Date;
  };
}> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Build prompts
    const systemPrompt = buildSystemPrompt(finalConfig.language);
    const userPrompt = buildUserPrompt(title, text);

    // Call OpenAI
    const openai = getOpenAIClient();
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

    if (!llmResponse) {
      return {
        success: false,
        error: 'Empty response from LLM',
        metadata: {
          promptVersion: PROMPT_VERSION,
          model: finalConfig.model,
          generatedAt: new Date(),
        },
      };
    }

    // Parse and validate the response
    const parsed = parseAndValidateLLMResponse(llmResponse);
    
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error,
        metadata: {
          promptVersion: PROMPT_VERSION,
          model: finalConfig.model,
          generatedAt: new Date(),
        },
      };
    }

    return {
      success: true,
      draft: parsed.data,
      metadata: {
        promptVersion: PROMPT_VERSION,
        model: finalConfig.model,
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during generation',
      metadata: {
        promptVersion: PROMPT_VERSION,
        model: finalConfig.model,
        generatedAt: new Date(),
      },
    };
  }
}

/**
 * Export the JSON schema as a plain object for documentation or API specs
 */
export function getResponseSchemaAsJSON() {
  return {
    type: 'object',
    required: ['headline', 'short_summary', 'what_happened', 'background', 'evidence'],
    properties: {
      headline: {
        type: 'string',
        minLength: 10,
        maxLength: 200,
        description: 'A clear, concise headline summarizing the story',
      },
      short_summary: {
        type: 'string',
        minLength: 50,
        maxLength: 500,
        description: 'A brief summary (2-3 sentences) of the entire story',
      },
      what_happened: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
        description: 'Array of key facts describing what happened, in chronological order',
      },
      background: {
        type: 'array',
        items: { type: 'string' },
        minItems: 0,
        maxItems: 10,
        description: 'Array of contextual information needed to understand the story',
      },
      evidence: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['claim_path', 'support'],
          properties: {
            claim_path: {
              type: 'string',
              description: 'JSON path to the claim, e.g., "what_happened[0]" or "background[1]"',
            },
            support: {
              type: 'string',
              description: 'Short quote or pointer from the source text supporting this claim',
            },
          },
        },
        description: 'Evidence linking each claim to the source text',
      },
    },
  };
}

