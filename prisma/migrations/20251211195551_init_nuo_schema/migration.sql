-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('WHAT_HAPPENED', 'BACKGROUND', 'RELATED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('EXTERNAL', 'NUO');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('STORY', 'SOURCE');

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
    "heroImageUrl" TEXT NOT NULL,
    "heroImageAlt" TEXT NOT NULL,
    "heroImageSourceCredit" TEXT,
    "tags" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "type" "SectionType" NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySource" (
    "storyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "StorySource_pkey" PRIMARY KEY ("storyId","sourceId")
);

-- CreateTable
CREATE TABLE "SectionSource" (
    "sectionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "SectionSource_pkey" PRIMARY KEY ("sectionId","sourceId")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE INDEX "Section_storyId_idx" ON "Section"("storyId");

-- CreateIndex
CREATE INDEX "StorySource_sourceId_idx" ON "StorySource"("sourceId");

-- CreateIndex
CREATE INDEX "SectionSource_sourceId_idx" ON "SectionSource"("sourceId");

-- CreateIndex
CREATE INDEX "SavedItem_userId_idx" ON "SavedItem"("userId");

-- CreateIndex
CREATE INDEX "SavedItem_targetType_targetId_idx" ON "SavedItem"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySource" ADD CONSTRAINT "StorySource_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySource" ADD CONSTRAINT "StorySource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSource" ADD CONSTRAINT "SectionSource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSource" ADD CONSTRAINT "SectionSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
