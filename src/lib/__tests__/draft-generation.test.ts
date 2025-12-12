/**
 * Tests for Nuo draft generation
 */

import { describe, it, expect } from '@jest/globals';
import {
  PROMPT_VERSION,
  NuoDraftResponseSchema,
  buildSystemPrompt,
  buildUserPrompt,
  parseAndValidateLLMResponse,
  getResponseSchemaAsJSON,
} from '@/server/services/ingestion-generator';

describe('Draft Generation', () => {
  describe('Prompt Version', () => {
    it('should have a valid semver version', () => {
      expect(PROMPT_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
    });
  });

  describe('System Prompt', () => {
    it('should generate Swedish system prompt', () => {
      const prompt = buildSystemPrompt('sv');
      expect(prompt).toContain('svenska');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('what_happened');
      expect(prompt).toContain('background');
      expect(prompt).toContain('evidence');
    });

    it('should generate English system prompt', () => {
      const prompt = buildSystemPrompt('en');
      expect(prompt).toContain('English');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('what_happened');
      expect(prompt).toContain('background');
      expect(prompt).toContain('evidence');
    });
  });

  describe('User Prompt', () => {
    it('should include title and text', () => {
      const title = 'Test Title';
      const text = 'Test article content';
      const prompt = buildUserPrompt(title, text);
      
      expect(prompt).toContain(title);
      expect(prompt).toContain(text);
    });

    it('should truncate long text', () => {
      const title = 'Test';
      const text = 'a'.repeat(10000);
      const prompt = buildUserPrompt(title, text);
      
      expect(prompt.length).toBeLessThan(text.length + 200);
      expect(prompt).toContain('trunkerats');
    });
  });

  describe('Response Schema Validation', () => {
    it('should validate correct response', () => {
      const validResponse = {
        headline: 'Test Headline About Important Event',
        short_summary: 'This is a brief summary of the event that happened recently in the news.',
        what_happened: [
          'First key event occurred',
          'Second development followed',
        ],
        background: [
          'Important context about the situation',
        ],
        evidence: [
          { claim_path: 'what_happened[0]', support: 'Quote from article' },
          { claim_path: 'what_happened[1]', support: 'Another supporting quote' },
        ],
      };

      expect(() => NuoDraftResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should reject response without headline', () => {
      const invalid = {
        short_summary: 'Summary text that meets minimum length requirements here.',
        what_happened: ['Event'],
        background: [],
        evidence: [{ claim_path: 'what_happened[0]', support: 'Quote' }],
      };

      expect(() => NuoDraftResponseSchema.parse(invalid)).toThrow();
    });

    it('should reject headline that is too short', () => {
      const invalid = {
        headline: 'Short',
        short_summary: 'Summary text that meets minimum length requirements here.',
        what_happened: ['Event'],
        background: [],
        evidence: [{ claim_path: 'what_happened[0]', support: 'Quote' }],
      };

      expect(() => NuoDraftResponseSchema.parse(invalid)).toThrow();
    });

    it('should reject response without what_happened', () => {
      const invalid = {
        headline: 'Valid Headline Here',
        short_summary: 'Summary text that meets minimum length requirements here.',
        what_happened: [],
        background: [],
        evidence: [],
      };

      expect(() => NuoDraftResponseSchema.parse(invalid)).toThrow();
    });

    it('should reject response without evidence', () => {
      const invalid = {
        headline: 'Valid Headline Here',
        short_summary: 'Summary text that meets minimum length requirements here.',
        what_happened: ['Event happened'],
        background: [],
        evidence: [],
      };

      expect(() => NuoDraftResponseSchema.parse(invalid)).toThrow();
    });

    it('should allow empty background array', () => {
      const valid = {
        headline: 'Valid Headline Here',
        short_summary: 'Summary text that meets minimum length requirements here.',
        what_happened: ['Event happened'],
        background: [],
        evidence: [{ claim_path: 'what_happened[0]', support: 'Quote' }],
      };

      expect(() => NuoDraftResponseSchema.parse(valid)).not.toThrow();
    });
  });

  describe('LLM Response Parsing', () => {
    const validJSON = JSON.stringify({
      headline: 'Test Headline About Important Event',
      short_summary: 'This is a brief summary of the event that happened recently.',
      what_happened: ['Event occurred'],
      background: ['Context'],
      evidence: [{ claim_path: 'what_happened[0]', support: 'Quote' }],
    });

    it('should parse valid JSON response', () => {
      const result = parseAndValidateLLMResponse(validJSON);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.headline).toBe('Test Headline About Important Event');
    });

    it('should strip markdown code blocks', () => {
      const withMarkdown = '```json\n' + validJSON + '\n```';
      const result = parseAndValidateLLMResponse(withMarkdown);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle invalid JSON', () => {
      const result = parseAndValidateLLMResponse('not valid json');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should handle JSON that does not match schema', () => {
      const invalidSchema = JSON.stringify({
        headline: 'Too short',
        what_happened: [],
      });
      
      const result = parseAndValidateLLMResponse(invalidSchema);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Schema validation failed');
    });

    it('should provide detailed validation errors', () => {
      const invalidSchema = JSON.stringify({
        headline: 'Short',
        short_summary: 'Too short',
        what_happened: [],
        background: [],
        evidence: [],
      });
      
      const result = parseAndValidateLLMResponse(invalidSchema);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Schema Export', () => {
    it('should export schema as JSON', () => {
      const schema = getResponseSchemaAsJSON();
      
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('headline');
      expect(schema.required).toContain('what_happened');
      expect(schema.properties.headline).toBeDefined();
      expect(schema.properties.evidence).toBeDefined();
    });
  });
});

