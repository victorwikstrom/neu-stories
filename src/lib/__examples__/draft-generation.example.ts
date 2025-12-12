/**
 * Example usage of the Nuo draft generation service
 * 
 * This demonstrates how to integrate the generator into your ingestion pipeline
 */

import {
  PROMPT_VERSION,
  generateNuoDraft,
  buildSystemPrompt,
  buildUserPrompt,
  parseAndValidateLLMResponse,
  type NuoDraftResponse,
} from '@/server/services/ingestion-generator';

/**
 * Example 1: Basic usage with mock LLM response
 */
export async function exampleBasicUsage() {
  const title = 'Ny lag om klimatförändringar antagen av riksdagen';
  const text = `
    Riksdagen röstade igår med bred majoritet för att anta den nya klimatlagen.
    Lagen innebär skärpta utsläppsmål för Sverige fram till 2030.
    
    Miljöminister Anna Svensson kommenterade beslutet: "Detta är ett historiskt steg
    för Sveriges klimatarbete. Vi sätter nu tydliga mål som industrin kan planera efter."
    
    Lagen träder i kraft den 1 januari nästa år och inkluderar bindande mål för
    minskning av växthusgaser med 60 procent jämfört med 1990 års nivåer.
    
    Näringslivets organisationer har uttryckt både stöd och oro. "Vi stödjer målen
    men behöver tydligare vägledning om hur vi ska nå dit," säger företrädare för
    Svenskt Näringsliv.
  `;

  try {
    // Generate draft (note: will fail until you implement LLM client)
    const result = await generateNuoDraft(title, text, {
      language: 'sv',
      temperature: 0.1,
    });

    if (result.success && result.draft) {
      console.log('Generated draft:', result.draft);
      console.log('Prompt version:', result.metadata.promptVersion);
      console.log('Model:', result.metadata.model);
    } else {
      console.error('Generation failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 2: Manual prompt building (for testing prompts directly)
 */
export function exampleManualPromptBuilding() {
  const title = 'Breaking News: Major Event';
  const text = 'Article content here...';

  // Build prompts separately
  const systemPrompt = buildSystemPrompt('sv');
  const userPrompt = buildUserPrompt(title, text);

  console.log('=== SYSTEM PROMPT ===');
  console.log(systemPrompt);
  console.log('\n=== USER PROMPT ===');
  console.log(userPrompt);
  console.log('\n=== PROMPT VERSION ===');
  console.log(PROMPT_VERSION);

  // You can now use these prompts with your LLM client of choice
}

/**
 * Example 3: Parsing and validating LLM response
 */
export function exampleResponseValidation() {
  // Simulate LLM response
  const mockLLMResponse = `{
    "headline": "Riksdagen antar ny klimatlag med skärpta utsläppsmål",
    "short_summary": "Riksdagen röstade med bred majoritet för en ny klimatlag som sätter bindande mål för Sverige att minska växthusgaser med 60 procent till 2030. Lagen träder i kraft nästa år.",
    "what_happened": [
      "Riksdagen röstade igår med bred majoritet för den nya klimatlagen",
      "Lagen sätter bindande mål om 60 procent minskning av växthusgaser jämfört med 1990",
      "Lagen träder i kraft den 1 januari nästa år"
    ],
    "background": [
      "Sverige har sedan tidigare klimatmål men denna lag gör dem bindande",
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
        "claim_path": "background[1]",
        "support": "Näringslivets organisationer har uttryckt både stöd och oro"
      }
    ]
  }`;

  const result = parseAndValidateLLMResponse(mockLLMResponse);

  if (result.success && result.data) {
    console.log('✓ Valid response');
    console.log('Headline:', result.data.headline);
    console.log('What happened items:', result.data.what_happened.length);
    console.log('Evidence items:', result.data.evidence.length);
  } else {
    console.error('✗ Invalid response:', result.error);
  }
}

/**
 * Example 4: Handling markdown-wrapped responses
 */
export function exampleMarkdownHandling() {
  // Some LLMs wrap JSON in markdown code blocks
  const markdownWrapped = `\`\`\`json
{
  "headline": "Test Headline That Meets Minimum Length",
  "short_summary": "A proper summary that is long enough to meet the minimum character requirement.",
  "what_happened": ["Event occurred"],
  "background": [],
  "evidence": [
    {
      "claim_path": "what_happened[0]",
      "support": "Quote from text"
    }
  ]
}
\`\`\``;

  const result = parseAndValidateLLMResponse(markdownWrapped);

  if (result.success) {
    console.log('✓ Successfully parsed markdown-wrapped response');
  }
}

/**
 * Example 5: Integration with ingestion pipeline
 */
export async function examplePipelineIntegration() {
  // This shows how you would integrate into the full pipeline
  // Assumes you have an IngestionJob with GENERATING status

  const jobId = 'example-job-id';
  
  // Step 1: Get job from database (pseudo-code)
  // const job = await getIngestionJobById(jobId);
  // if (job.status !== 'GENERATING') return;

  // Step 2: Generate draft
  const mockTitle = 'Article Title';
  const mockText = 'Article text content...';
  
  const result = await generateNuoDraft(mockTitle, mockText);

  if (!result.success) {
    console.error('Draft generation failed:', result.error);
    // Update job to FAILED status
    // await updateIngestionJob({
    //   id: jobId,
    //   status: 'FAILED',
    //   errorMessage: result.error,
    // });
    return;
  }

  // Step 3: Convert draft to Story format
  const draft = result.draft as NuoDraftResponse;
  
  // Map to Story schema (pseudo-code)
  const story = {
    headline: draft.headline,
    summary: draft.short_summary,
    status: 'DRAFT',
    promptVersion: result.metadata.promptVersion,
    modelName: result.metadata.model,
    generatedAt: result.metadata.generatedAt,
    sections: [
      // Map what_happened to sections
      ...draft.what_happened.map((body, index) => ({
        type: 'WHAT_HAPPENED',
        body,
        order: index,
      })),
      // Map background to sections
      ...draft.background.map((body, index) => ({
        type: 'BACKGROUND',
        body,
        order: draft.what_happened.length + index,
      })),
    ],
  };

  console.log('Story draft created:', story);

  // Step 4: Save to database
  // await createStory(story);
  // await updateIngestionJob({
  //   id: jobId,
  //   status: 'SAVED',
  //   generatedAt: new Date(),
  // });
}

/**
 * Example 6: Testing different languages
 */
export async function exampleMultiLanguage() {
  const title = 'Breaking: Major Policy Change';
  const text = 'The government announced a significant policy shift today...';

  // Generate in Swedish
  const svResult = await generateNuoDraft(title, text, { language: 'sv' });
  
  // Generate in English
  const enResult = await generateNuoDraft(title, text, { language: 'en' });

  console.log('Swedish prompt version:', svResult.metadata.promptVersion);
  console.log('English prompt version:', enResult.metadata.promptVersion);
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('=== Example 2: Manual Prompt Building ===\n');
  exampleManualPromptBuilding();

  console.log('\n=== Example 3: Response Validation ===\n');
  exampleResponseValidation();

  console.log('\n=== Example 4: Markdown Handling ===\n');
  exampleMarkdownHandling();
}

