# Server Queries

This directory contains specialized query functions for specific UI views and use cases.

## Story Queries

### `getPublishedStoryWithDepth(slugOrId: string)`

Fetches a published story with depth view data for Phase 5 implementation.

**Parameters:**
- `slugOrId`: Can be either the story's slug or id

**What it returns:**
- Story metadata: `id`, `headline`, `summary`, `publishedAt`
- Filtered sections: only `what_happened` and `background` types
- For each section: full source objects (not just IDs)
- Sections ordered by `order` field (ascending)

**Return value:**
- `StoryWithDepth` object if story exists and is published
- `null` if story not found or not published

**Type signature:**
```typescript
type StoryWithDepth = {
  id: string;
  headline: string;
  summary: string;
  publishedAt: string; // ISO datetime string
  sections: Array<{
    id: string;
    type: 'what_happened' | 'background';
    title: string | null;
    body: string;
    order: number;
    sources: Array<{
      id: string;
      label: string;
      domain: string;
      url: string;
    }>;
  }>;
};
```

## Usage Examples

### In a Route Handler (API Route)

```typescript
// src/app/api/stories/[slug]/depth/route.ts
import { NextResponse } from 'next/server';
import { getPublishedStoryWithDepth } from '@/server/queries/story';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  
  const story = await getPublishedStoryWithDepth(slug);
  
  if (!story) {
    return NextResponse.json(
      { error: 'Story not found or not published' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(story);
}
```

### In a Server Component (Page)

```typescript
// src/app/stories/[slug]/depth/page.tsx
import { notFound } from 'next/navigation';
import { getPublishedStoryWithDepth } from '@/server/queries/story';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function StoryDepthPage({ params }: Props) {
  const { slug } = await params;
  const story = await getPublishedStoryWithDepth(slug);
  
  if (!story) {
    notFound();
  }
  
  return (
    <div>
      <h1>{story.headline}</h1>
      <p>{story.summary}</p>
      
      {story.sections.map((section) => (
        <section key={section.id}>
          <h2>{section.title || section.type}</h2>
          <p>{section.body}</p>
          
          <div>
            <h3>Sources:</h3>
            <ul>
              {section.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.label} ({source.domain})
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
```

### In a Server Action

```typescript
// src/app/actions/story-actions.ts
'use server';

import { getPublishedStoryWithDepth } from '@/server/queries/story';

export async function fetchStoryDepth(slug: string) {
  const story = await getPublishedStoryWithDepth(slug);
  
  if (!story) {
    throw new Error('Story not found or not published');
  }
  
  return story;
}
```

## Notes

- All queries return strongly-typed results validated with Zod schemas
- Queries follow the "return null for not found" pattern consistent with the repository layer
- The `getPublishedStoryWithDepth` function filters sections at the database level for efficiency
- Sources are eagerly loaded with sections to avoid N+1 query problems

