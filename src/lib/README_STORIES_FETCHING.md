# Client-Side Data Fetching Layer for Published Stories

## Overview

This module provides a reusable client-side data fetching layer for published stories. It includes both a React hook (`useStories`) and a plain async function (`fetchStories`) for maximum flexibility.

## Features

- ✅ React hook for client-side fetching with state management
- ✅ Plain async function for use outside React components
- ✅ Full TypeScript support with types inferred from Prisma Story model
- ✅ Loading, success, and error state handling
- ✅ Default pagination (limit: 20, offset: 0)
- ✅ Stories returned in descending order by publishedAt (newest first)
- ✅ Fully typed story data including all required fields

## API

### `useStories(params?)` Hook

React hook that fetches published stories and manages loading/error states.

**Parameters:**
- `params` (optional): Object with `limit` and `offset` properties
  - `limit` (number): Number of stories to fetch (default: 20)
  - `offset` (number): Offset for pagination (default: 0)

**Returns:**
```typescript
{
  data: Story[] | null;     // Array of stories or null if loading/error
  isLoading: boolean;        // True while fetching
  error: string | null;      // Error message if fetch failed
}
```

**Example:**
```typescript
import { useStories } from '@/lib/use-stories';

function StoriesList() {
  const { data: stories, isLoading, error } = useStories();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stories) return <div>No stories found</div>;

  return (
    <div>
      {stories.map(story => (
        <article key={story.id}>
          <h2>{story.headline}</h2>
          <p>{story.summary}</p>
        </article>
      ))}
    </div>
  );
}
```

### `fetchStories(params?)` Function

Async function for fetching published stories. Can be used in server components, utility functions, or anywhere outside React.

**Parameters:**
- `params` (optional): Object with `limit` and `offset` properties

**Returns:**
- `Promise<Story[]>`: Array of Story objects

**Throws:**
- `Error` if the API request fails

**Example:**
```typescript
import { fetchStories } from '@/lib/use-stories';

// Simple fetch
const stories = await fetchStories();

// With pagination
const moreStories = await fetchStories({ limit: 10, offset: 20 });

// Error handling
try {
  const stories = await fetchStories();
  console.log('Loaded', stories.length, 'stories');
} catch (error) {
  console.error('Failed to load stories:', error);
}
```

## Story Type

The `Story` type is fully typed and includes all fields from the Prisma model:

```typescript
type Story = {
  // Required fields
  id: string;
  slug: string;
  headline: string;
  summary: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'discarded';
  sections: Section[];
  primarySources: Source[];
  createdAt: string;  // ISO datetime
  updatedAt: string;  // ISO datetime
  
  // Optional fields
  heroImage?: {
    url: string;
    alt: string;
    sourceCredit?: string;
  };
  tags?: string[];
  publishedAt?: string;     // ISO datetime
  discardedAt?: string;     // ISO datetime
  promptVersion?: string;
  modelName?: string;
  generatedAt?: string;     // ISO datetime
}
```

## Implementation Details

### State Management
- Uses React's `useState` and `useEffect` for state management
- Implements cleanup to prevent memory leaks from unmounted components
- Re-fetches when pagination parameters change

### Error Handling
- Network errors are caught and returned in the `error` state
- API error messages are extracted from response JSON when available
- Falls back to status text if no error message is provided

### Type Safety
- All types are inferred from the Zod schema in `story-schema.ts`
- No type casting or `any` types used
- Full autocomplete support in IDEs

### API Integration
- Calls `/api/stories` route handler
- Sends `limit` and `offset` as URL search parameters
- Only returns published stories (enforced by API)

## Testing

See `src/lib/__examples__/use-stories.example.ts` for comprehensive usage examples.

## Requirements Met

✅ Reusable async function (`fetchStories`) and hook (`useStories`)  
✅ Handles loading, success, and error states  
✅ Returns ordered list of stories (newest first, handled by API)  
✅ Types inferred correctly from Prisma Story model  
✅ Supports all required data fields:
  - id
  - slug
  - headline
  - summary
  - heroImageUrl (via `heroImage.url`)
  - publishedAt

✅ Default params: limit 20, offset 0  
✅ No caching or revalidation (as requested)  
✅ No UI implementation (as requested)  

## Next Steps

This data fetching layer is ready to be used in your UI components. When you're ready to implement the UI:

1. Import `useStories` in your page component
2. Handle the three states (loading, error, success)
3. Render the story list using the typed `Story[]` data

