# Reading List MVP Implementation

## Overview
Implemented a minimal reading list feature that allows users to save sources from the Depth View for later reading.

## Backend Changes

### Database
**Existing Model:** `SavedItem` in Prisma schema
- Already supports both STORY and SOURCE types
- Composite primary key: `[userId, targetType, targetId]`
- Indexes for efficient queries

### API Route
**File:** `src/app/api/reading-list/route.ts`

**Endpoint:** `POST /api/reading-list`

**Request Body:**
```json
{
  "sourceId": "string"
}
```

**Response (201):**
```json
{
  "id": "global-user_SOURCE_<sourceId>",
  "sourceId": "string",
  "createdAt": "ISO-8601 timestamp"
}
```

**Error Responses:**
- 400: Missing or invalid sourceId
- 500: Internal server error

**Auth Strategy (MVP):**
- Uses hardcoded user ID: `"global-user"`
- Global reading list shared by all users
- TODO: Replace with actual authentication

### Repository
**File:** `src/server/repositories/savedItemRepository.ts`
- Reuses existing `saveItem()` function
- Idempotent: uses upsert to avoid duplicates
- Returns SavedItem from Prisma

## Frontend Changes

### Toast Component
**File:** `src/components/Toast.tsx`

Simple notification component:
- Auto-dismisses after 3 seconds (configurable)
- Fade in/out animations
- Fixed position at bottom center
- Dark mode support
- Accessible with ARIA attributes

### Depth Sections Component
**File:** `src/components/DepthSections.tsx`

Client component that renders depth sections with interactive save buttons:
- Displays what_happened and background sections
- Each source has a "Save" button
- Handles API calls to save sources
- Shows toast notifications on success/error
- Loading state: button shows "Saving..." while request in flight
- Only one save operation at a time per component

**Save Button Styling:**
- Small button: `px-2 py-1 text-xs`
- Dark background with light text (inverted in dark mode)
- Disabled state with reduced opacity
- Hover effect for better UX

### Updated Depth View Page
**File:** `src/app/stories/[slug]/depth/page.tsx`
- Remains a server component
- Uses new `DepthSections` client component for interactive features
- Passes sections data as props

## User Flow

1. User navigates to depth view of a story
2. Sees sources listed under each section
3. Clicks "Save" button next to a source
4. Button shows "Saving..." during request
5. On success: Toast appears with "Saved to reading list 📚"
6. On error: Toast appears with "Could not save"
7. Toast auto-dismisses after 3 seconds

## MVP Constraints

### What's Implemented
✅ Save source to reading list
✅ Success/error feedback via toast
✅ Loading state on buttons
✅ Idempotent saves (no duplicates)
✅ Dark mode support

### What's NOT Implemented (Deferred)
❌ User authentication (uses global user)
❌ View reading list page
❌ Remove from reading list
❌ Visual indicator for already-saved sources
❌ Save confirmation dialog
❌ Multiple toasts at once (last one replaces previous)

## Testing Instructions

### Manual Testing

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Navigate to a story depth view**
   - Go to home page
   - Click down arrow on a story card
   - Should see depth view with sources

3. **Test saving a source**
   - Click "Save" button next to any source
   - Should see button change to "Saving..."
   - Should see toast "Saved to reading list 📚"
   - Toast should auto-dismiss after 3 seconds

4. **Test duplicate save**
   - Click "Save" on the same source again
   - Should still succeed (idempotent)
   - Should show success toast

5. **Verify database**
   ```bash
   # Using Prisma Studio
   npx prisma studio
   
   # Check SavedItem table
   # Should see entries with:
   # - userId: "global-user"
   # - targetType: "SOURCE"
   # - targetId: <source id>
   ```

### API Testing with curl

```bash
# Save a source (replace SOURCE_ID with actual source ID)
curl -X POST http://localhost:3000/api/reading-list \
  -H "Content-Type: application/json" \
  -d '{"sourceId":"SOURCE_ID"}'

# Expected response (201):
# {"id":"global-user_SOURCE_<id>","sourceId":"<id>","createdAt":"2025-..."}

# Test missing sourceId (400 error)
curl -X POST http://localhost:3000/api/reading-list \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response (400):
# {"error":"sourceId is required"}
```

### Integration with Existing System

The reading list uses the existing `SavedItem` infrastructure:
- Same database table as story saves
- Compatible with existing `/api/saved` endpoints
- Can query saved sources using `getSavedItemsForUser('global-user')`

## Future Enhancements

1. **Authentication**
   - Replace `getCurrentUserId()` with real auth
   - Per-user reading lists

2. **Reading List Page**
   - Display saved sources
   - Remove from list functionality
   - Filter/search saved items

3. **Visual Feedback**
   - Show checkmark for already-saved sources
   - Change button to "Saved" with different styling

4. **Enhanced UX**
   - Undo save action
   - Bulk save/remove
   - Categories or tags for saved items

5. **Toast Improvements**
   - Queue multiple toasts
   - Different toast types (success, error, info)
   - Close button on toast

