# Phase 5: Depth View Implementation

## Overview
Implemented a depth view route that displays "What Happened" and "Background" sections with their sources for published stories.

## Latest Updates

### Swipe Down Gesture (NEW)
Added swipe down gesture to open depth view from story card. See `SWIPE_GESTURES.md` for detailed documentation.

**Quick Summary:**
- Swipe down on story card → Opens depth view
- Keyboard: Down arrow key also works
- Intelligent disambiguation: Vertical vs horizontal gestures
- Higher threshold (80px) to avoid accidental triggers

### Reading List Feature
Added "Save to reading list" functionality for sources in the depth view. See `READING_LIST_MVP.md` for detailed documentation.

**Quick Summary:**
- Each source has a "Save" button
- Click to save source to reading list (global for MVP)
- Toast notification on success/error
- Uses existing SavedItem infrastructure

## Changes Made

### 1. Query Layer Updates

**File:** `src/server/queries/story.ts`
- Modified `getPublishedStoryWithDepth()` to accept both slug and id
- Changed from `findUnique` to `findFirst` with OR condition for flexibility
- Query filters sections at database level for efficiency
- Returns strongly-typed `StoryWithDepth` object with Zod validation

### 2. New Depth View Route

**File:** `src/app/stories/[slug]/depth/page.tsx`
- Server component that fetches story depth data
- Renders headline, what_happened section, and background section
- Each section displays associated sources in numbered list format: `[1] Source: <label>`
- Numbering restarts per section (what_happened starts at [1], background starts at [1])
- Sources are external links with underline styling
- Back button in sticky header to return to story reader
- Uses Next.js `notFound()` for 404 handling

**File:** `src/app/stories/[slug]/depth/loading.tsx`
- Loading state with spinner matching existing design patterns
- Displayed while server component fetches data

### 3. Story Card Enhancement

**File:** `src/components/StoryCard.tsx`
- Added `slug` prop to enable navigation
- Added down arrow button at bottom center
- Button styled with backdrop blur and subtle hover effects
- Links to `/stories/{slug}/depth` route
- `stopPropagation()` prevents click from triggering story navigation

**File:** `src/components/StoryReader.tsx`
- Updated to pass `slug` prop to `StoryCard`

### 4. Documentation

**File:** `src/server/queries/README.md`
- Updated examples to reflect slug-based routing
- Added Next.js 15 async params pattern
- Clarified that function accepts both slug and id

## Design Decisions

### Routing Convention
- Followed existing pattern: `/stories/[slug]/depth`
- Consistent with `/stories/[slug]` for story reader

### Data Access
- Query filters at database level for performance
- Eagerly loads sources to avoid N+1 queries
- Only fetches published stories
- Returns null for not found/unpublished

### UI/UX
- Minimal design matching existing aesthetic
- Sticky header with back button
- Normal page scroll (no custom scroll containers)
- Down arrow positioned at bottom center of story card
- Clear visual hierarchy: headline → what happened → background
- Sources displayed as simple numbered lists below each section (MVP format)

### Styling
- Uses existing Tailwind classes
- Dark mode support throughout
- Responsive design with max-width constraints
- Simple underlined links for sources

### Sources Display (MVP)
- Format: `[1] Source: <label>` as external link
- Numbering restarts per section (independent numbering)
- No inline highlighting or annotations (deferred for future)
- Simple list format below each section body
- External links with `target="_blank"` and `rel="noopener noreferrer"`

## Navigation Flow

```
Story Reader (StoryCard)
    ↓ (down arrow button OR swipe down OR ↓ key)
Depth View (/stories/[slug]/depth)
    ↓ (back button)
Story Reader (returns to same story)

Story Reader Gestures:
- Swipe left/right: Navigate between stories
- Swipe down: Open depth view
- Keyboard: ← → for stories, ↓ for depth view
```

## Type Safety

All components and queries are fully typed:
- `StoryWithDepth` type for depth data
- `DepthSection` type for section structure
- `DepthSource` type for source information
- Zod runtime validation ensures data integrity

## Constraints Met

✅ Public view only (no auth)
✅ Simple loading spinner
✅ Uses existing Tailwind patterns
✅ No custom scroll containers (normal page scroll)
✅ Minimal implementation
✅ Follows existing routing conventions
✅ Consistent with Phase 4 design system

## Testing Recommendations

1. Navigate to a published story in story reader
2. Click down arrow at bottom of card
3. Verify depth view loads with headline and sections
4. Check that sources are properly displayed
5. Click back button to return to story reader
6. Test with stories that have missing sections
7. Verify dark mode styling
8. Test on mobile and desktop viewports

## Assumptions

1. Stories will have at least one of: what_happened or background section
2. Sources are associated at section level (not story level)
3. Normal page scroll is acceptable for MVP
4. No animation needed when entering/exiting depth view
5. Back button returns to story reader (not browser history)

