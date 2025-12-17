/**
 * Type validation for useStories
 * 
 * This file verifies that:
 * 1. Types are correctly inferred from the Story schema
 * 2. The hook and function signatures are correct
 * 3. All required fields are accessible
 * 
 * Run with: npx tsc --noEmit src/lib/__tests__/use-stories.types.test.ts
 */

import type { Story } from '../story-schema';
import { fetchStories, useStories } from '../use-stories';
import type { StoriesState, FetchStoriesParams } from '../use-stories';

// ============================================
// Type Tests - These should compile without errors
// ============================================

// Test 1: Story type has all required fields
function testStoryType(story: Story) {
  // Required fields that must be present
  const id: string = story.id;
  const slug: string = story.slug;
  const headline: string = story.headline;
  const summary: string = story.summary;
  const sections: Story['sections'] = story.sections;
  const primarySources: Story['primarySources'] = story.primarySources;
  const createdAt: string = story.createdAt;
  const updatedAt: string = story.updatedAt;
  
  // Optional fields
  const heroImageUrl: string | undefined = story.heroImage?.url;
  const heroImageAlt: string | undefined = story.heroImage?.alt;
  const publishedAt: string | undefined = story.publishedAt;
  const tags: string[] | undefined = story.tags;
  
  // Status should be one of the enum values
  const status: 'draft' | 'review' | 'published' | 'archived' | 'discarded' = story.status;
  
  console.log('All required fields accessible:', { 
    id, slug, headline, summary, heroImageUrl, publishedAt, 
    sectionsCount: sections.length, 
    sourcesCount: primarySources.length,
    status,
    tags,
    heroImageAlt,
    createdAt,
    updatedAt
  });
}

// Test 2: fetchStories function signature
async function testFetchStories() {
  // Should work with no params (defaults)
  const stories1: Story[] = await fetchStories();
  
  // Should work with partial params
  const stories2: Story[] = await fetchStories({ limit: 10 });
  const stories3: Story[] = await fetchStories({ offset: 20 });
  const stories4: Story[] = await fetchStories({ limit: 10, offset: 20 });
  
  // Return type should be Story[]
  stories1.forEach(testStoryType);
  
  console.log('fetchStories signature validated');
}

// Test 3: useStories hook return type
function testUseStoriesHook() {
  // Should work with no params
  const state1: StoriesState = useStories();
  
  // Should work with params
  const state2: StoriesState = useStories({ limit: 10 });
  const state3: StoriesState = useStories({ offset: 20 });
  const state4: StoriesState = useStories({ limit: 10, offset: 20 });
  
  // Verify return type structure
  const data: Story[] | null = state1.data;
  const isLoading: boolean = state1.isLoading;
  const error: string | null = state1.error;
  
  // Data should be Story[] when not null
  if (data) {
    data.forEach(testStoryType);
  }
  
  console.log('useStories signature validated', { data, isLoading, error });
}

// Test 4: FetchStoriesParams type
function testParamsType() {
  const params1: FetchStoriesParams = {};
  const params2: FetchStoriesParams = { limit: 20 };
  const params3: FetchStoriesParams = { offset: 0 };
  const params4: FetchStoriesParams = { limit: 20, offset: 0 };
  
  console.log('FetchStoriesParams type validated', { params1, params2, params3, params4 });
}

// Test 5: StoriesState type
function testStateType() {
  const state1: StoriesState = {
    data: null,
    isLoading: true,
    error: null,
  };
  
  const state2: StoriesState = {
    data: [],
    isLoading: false,
    error: null,
  };
  
  const state3: StoriesState = {
    data: null,
    isLoading: false,
    error: 'Failed to fetch',
  };
  
  console.log('StoriesState type validated', { state1, state2, state3 });
}

// Test 6: Story array operations
function testStoryArrayOperations(stories: Story[]) {
  // Should support standard array operations
  const firstStory = stories[0];
  const headlines = stories.map(s => s.headline);
  const published = stories.filter(s => s.status === 'published');
  const sorted = [...stories].sort((a, b) => 
    (a.publishedAt || '').localeCompare(b.publishedAt || '')
  );
  
  console.log('Story array operations validated', { 
    firstStory, 
    headlinesCount: headlines.length, 
    publishedCount: published.length,
    sortedCount: sorted.length
  });
}

// Test 7: Error handling type safety
async function testErrorHandling() {
  try {
    await fetchStories();
  } catch (error) {
    if (error instanceof Error) {
      const message: string = error.message;
      console.log('Error message:', message);
    }
  }
}

console.log('✓ All type checks passed');

export { 
  testStoryType, 
  testFetchStories, 
  testUseStoriesHook, 
  testParamsType, 
  testStateType, 
  testStoryArrayOperations,
  testErrorHandling
};

