/**
 * Tests for text extraction logic
 * 
 * Run with: npx tsx src/lib/__tests__/text-extraction.test.ts
 */

import * as cheerio from 'cheerio';
import {
  articleWithOgTags,
  simpleBlogPost,
  articleWithTwitterTags,
  articleWithRepeatedElements,
  minimalArticle,
  complexArticle,
  expectedResults,
} from '../__fixtures__/html-samples';

// Simple test utilities
let testCount = 0;
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${message}`);
  } else {
    failedCount++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

function assertIncludes(text: string | null, substring: string, message: string) {
  assert(
    text !== null && text.includes(substring),
    `${message} (should include: "${substring}")`
  );
}

function assertExcludes(text: string | null, substring: string, message: string) {
  assert(
    text === null || !text.includes(substring),
    `${message} (should not include: "${substring}")`
  );
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// Extraction functions (duplicated from service for testing)
function extractTitle($: ReturnType<typeof cheerio.load>): string | null {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle?.trim()) {
    return normalizeText(ogTitle);
  }

  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  if (twitterTitle?.trim()) {
    return normalizeText(twitterTitle);
  }

  const titleTag = $('title').first().text();
  if (titleTag?.trim()) {
    return normalizeText(titleTag);
  }

  const h1 = $('h1').first().text();
  if (h1?.trim()) {
    return normalizeText(h1);
  }

  return null;
}

function extractText($: ReturnType<typeof cheerio.load>): string | null {
  $('script, style, noscript, iframe, svg').remove();
  $('nav, header, footer, aside').remove();
  $('.nav, .navigation, .menu, .sidebar, .header, .footer, .advertisement, .ads, .social-share').remove();
  $('[role="navigation"], [role="banner"], [role="complementary"]').remove();

  const articleSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    '#article',
    '#content',
    '.story-body',
  ];

  for (const selector of articleSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text();
      if (text.trim().length > 200) {
        return normalizeAndCleanText(text);
      }
    }
  }

  const bodyText = $('body').text();
  if (bodyText?.trim()) {
    return normalizeAndCleanText(bodyText);
  }

  return null;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function normalizeAndCleanText(text: string): string {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ');

  const lines = cleaned.split('\n');
  const seen = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    
    if (!seen.has(trimmed) || trimmed.length < 30) {
      seen.add(trimmed);
      uniqueLines.push(trimmed);
    }
  }

  return uniqueLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Tests
describe('Title Extraction', () => {
  describe('Article with Open Graph tags', () => {
    const $ = cheerio.load(articleWithOgTags);
    const title = extractTitle($);
    
    assertEqual(
      title,
      expectedResults.articleWithOgTags.title,
      'Should extract og:title'
    );
  });

  describe('Article with Twitter tags only', () => {
    const $ = cheerio.load(articleWithTwitterTags);
    const title = extractTitle($);
    
    assertEqual(
      title,
      expectedResults.articleWithTwitterTags.title,
      'Should extract twitter:title when og:title is missing'
    );
  });

  describe('Article with only title tag', () => {
    const $ = cheerio.load(simpleBlogPost);
    const title = extractTitle($);
    
    assertEqual(
      title,
      expectedResults.simpleBlogPost.title,
      'Should extract <title> when meta tags are missing'
    );
  });

  describe('Article with h1 fallback', () => {
    const html = '<html><body><h1>Test Heading</h1><p>Content</p></body></html>';
    const $ = cheerio.load(html);
    const title = extractTitle($);
    
    assertEqual(
      title,
      'Test Heading',
      'Should extract h1 when all other title sources are missing'
    );
  });
});

describe('Text Extraction', () => {
  describe('Article with Open Graph tags', () => {
    const $ = cheerio.load(articleWithOgTags);
    const text = extractText($);
    
    for (const phrase of expectedResults.articleWithOgTags.textIncludes) {
      assertIncludes(text, phrase, `Should include "${phrase}"`);
    }
    
    for (const phrase of expectedResults.articleWithOgTags.textExcludes) {
      assertExcludes(text, phrase, `Should exclude "${phrase}"`);
    }
  });

  describe('Simple blog post', () => {
    const $ = cheerio.load(simpleBlogPost);
    const text = extractText($);
    
    for (const phrase of expectedResults.simpleBlogPost.textIncludes) {
      assertIncludes(text, phrase, `Should include "${phrase}"`);
    }
  });

  describe('Article with Twitter tags', () => {
    const $ = cheerio.load(articleWithTwitterTags);
    const text = extractText($);
    
    for (const phrase of expectedResults.articleWithTwitterTags.textIncludes) {
      assertIncludes(text, phrase, `Should include "${phrase}"`);
    }
    
    for (const phrase of expectedResults.articleWithTwitterTags.textExcludes) {
      assertExcludes(text, phrase, `Should exclude "${phrase}"`);
    }
  });

  describe('Complex article', () => {
    const $ = cheerio.load(complexArticle);
    const text = extractText($);
    
    for (const phrase of expectedResults.complexArticle.textIncludes) {
      assertIncludes(text, phrase, `Should include "${phrase}"`);
    }
    
    for (const phrase of expectedResults.complexArticle.textExcludes) {
      assertExcludes(text, phrase, `Should exclude "${phrase}"`);
    }
  });
});

describe('Content Validation', () => {
  describe('Minimal article', () => {
    const $ = cheerio.load(minimalArticle);
    const text = extractText($);
    
    assert(
      text !== null && text.length > 0 && text.length < 150,
      `Should extract text but be below minimum length threshold (got ${text?.length || 0} chars)`
    );
  });

  describe('Article with repeated elements', () => {
    const $ = cheerio.load(articleWithRepeatedElements);
    const text = extractText($);
    
    // Count occurrences of "Home" (which appears in nav multiple times)
    const homeOccurrences = (text || '').split('Home').length - 1;
    
    assert(
      homeOccurrences <= 1,
      `Should deduplicate repeated navigation items (found ${homeOccurrences} occurrences)`
    );
  });
});

describe('Text Normalization', () => {
  describe('Whitespace normalization', () => {
    const text = '  Multiple   spaces   and\n\n\nnewlines  ';
    const normalized = normalizeText(text);
    
    assertEqual(
      normalized,
      'Multiple spaces and newlines',
      'Should normalize whitespace'
    );
  });

  describe('Line deduplication', () => {
    const text = 'This is a repeated line that is definitely long enough to be deduplicated\nAnother unique line here\nThis is a repeated line that is definitely long enough to be deduplicated\nA third unique line in the text';
    const cleaned = normalizeAndCleanText(text);
    const lines = cleaned.split('\n');
    
    // Should have 3 unique lines (long lines get deduplicated)
    assert(
      lines.length === 3,
      `Should remove duplicate long lines (got ${lines.length} lines, expected 3)`
    );
  });

  describe('Multiple newline collapsing', () => {
    const text = 'Paragraph 1\n\n\n\n\nParagraph 2';
    const cleaned = normalizeAndCleanText(text);
    
    assert(
      !cleaned.includes('\n\n\n'),
      'Should collapse multiple newlines to at most two'
    );
  });
});

// Print summary
console.log('\n' + '='.repeat(50));
console.log(`Total tests: ${testCount}`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);
console.log('='.repeat(50));

// Exit with appropriate code
process.exit(failedCount > 0 ? 1 : 0);

