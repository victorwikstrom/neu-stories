# Phase 3 Schema Changes - Summary

## Overview
Minimal changes to support Phase 3 admin workflow: Draft list, Draft edit, Publish, Discard.

## Changes Implemented

### 1. Database Schema (Prisma)

#### Added to `StoryStatus` enum:
- `DISCARDED` - New status for discarded stories

#### Added to `Story` model:
- `discardedAt DateTime?` - Nullable timestamp for when story was discarded
- New index: `@@index([status, discardedAt])` - For efficient draft/discarded queries

### 2. TypeScript Schemas

Updated both:
- `src/lib/story-schema.ts`
- `src/app/lib/story-schema.ts`

#### Changes:
- Added `'discarded'` to status enum
- Added `discardedAt: z.string().datetime().optional()` field

### 3. Migration

**File:** `prisma/migrations/20251216000000_add_discarded_status/migration.sql`

```sql
-- AlterEnum: Add DISCARDED status to StoryStatus
ALTER TYPE "StoryStatus" ADD VALUE 'DISCARDED';

-- AlterTable: Add discardedAt column to Story
ALTER TABLE "Story" ADD COLUMN "discardedAt" TIMESTAMP(3);

-- CreateIndex: Add index for status and discardedAt queries
CREATE INDEX "Story_status_discardedAt_idx" ON "Story"("status", "discardedAt");
```

## What Already Existed (No Changes Needed)

✅ Story has `status` field with DRAFT/REVIEW/PUBLISHED/ARCHIVED  
✅ Story has `createdAt`, `updatedAt`, `publishedAt` (nullable)  
✅ Sections belong to Story with `type` (WHAT_HAPPENED/BACKGROUND/RELATED)  
✅ Sections have editable `body` field  
✅ Sources can link to sections via `SectionSource` (preferred)  
✅ Sources can link to stories via `StorySource` (alternative)  

## Phase 3 Admin Workflow Support

### Draft List
Query stories with `status = 'DRAFT'` or `status = 'DISCARDED'`, order by `createdAt` or `updatedAt`

### Draft Edit
Update Story fields (headline, summary, sections, etc.) - all existing fields are editable

### Publish
```typescript
await prisma.story.update({
  where: { id },
  data: {
    status: 'PUBLISHED',
    publishedAt: new Date(),
  }
});
```

### Discard
```typescript
await prisma.story.update({
  where: { id },
  data: {
    status: 'DISCARDED',
    discardedAt: new Date(),
  }
});
```

## Next Steps

To apply the migration to your database:

```bash
npx prisma migrate deploy
```

Or for development:

```bash
npx prisma migrate dev
```

## Notes

- Kept existing `REVIEW` and `ARCHIVED` statuses for backward compatibility (Option A)
- All changes are additive - no breaking changes
- Prisma Client has been regenerated with the new schema

