/**
 * Example usage of useStories hook and fetchStories function
 * 
 * This file demonstrates how to use the client-side data fetching layer
 * for published stories.
 */

import { useStories, fetchStories } from '../use-stories';
import type { Story } from '../story-schema';

// ============================================
// Example 1: Using the React hook
// ============================================
export function StoriesListExample() {
  const { data: stories, isLoading, error } = useStories();

  if (isLoading) {
    return <div>Loading stories...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!stories || stories.length === 0) {
    return <div>No stories found</div>;
  }

  return (
    <div>
      {stories.map((story) => (
        <article key={story.id}>
          <h2>{story.headline}</h2>
          <p>{story.summary}</p>
          {story.heroImage && (
            <img src={story.heroImage.url} alt={story.heroImage.alt} />
          )}
          <time>{new Date(story.publishedAt!).toLocaleDateString()}</time>
        </article>
      ))}
    </div>
  );
}

// ============================================
// Example 2: Using the hook with custom params
// ============================================
export function PaginatedStoriesExample() {
  const { data: stories, isLoading, error } = useStories({ 
    limit: 10, 
    offset: 0 
  });

  // Handle states...
  return <div>...</div>;
}

// ============================================
// Example 3: Using the plain fetch function
// ============================================
export async function loadStoriesOnServer() {
  try {
    // Fetch first 20 stories (default)
    const stories = await fetchStories();
    return stories;
  } catch (error) {
    console.error('Failed to load stories:', error);
    return [];
  }
}

// ============================================
// Example 4: Using fetch with pagination
// ============================================
export async function loadMoreStories(offset: number) {
  const stories = await fetchStories({ 
    limit: 20, 
    offset 
  });
  return stories;
}

// ============================================
// Example 5: Accessing story data
// ============================================
export function displayStoryInfo(story: Story) {
  console.log('Story ID:', story.id);
  console.log('Slug:', story.slug);
  console.log('Headline:', story.headline);
  console.log('Summary:', story.summary);
  console.log('Hero Image URL:', story.heroImage?.url);
  console.log('Published At:', story.publishedAt);
  console.log('Tags:', story.tags?.join(', '));
  console.log('Sections:', story.sections.length);
  console.log('Primary Sources:', story.primarySources.length);
}

