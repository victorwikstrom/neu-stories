'use client';

import React from 'react';
import { useStories } from '@/lib/use-stories';
import { StoryReader } from '@/components/StoryReader';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default function StoryPage({ params }: PageProps) {
  const { data: stories, isLoading, error } = useStories();
  const resolvedParams = React.use(params);
  const { slug } = resolvedParams;

  // Loading state
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center bg-zinc-50 dark:bg-black" 
        style={{ height: '100dvh' }}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50"
            aria-hidden="true"
          />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Loading stories...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-zinc-50 dark:bg-black" 
        style={{ height: '100dvh' }}
        role="alert"
      >
        <div className="max-w-md px-6 text-center">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Failed to load stories
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {error}
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!stories || stories.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-zinc-50 dark:bg-black" 
        style={{ height: '100dvh' }}
      >
        <div className="max-w-md px-6 text-center">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            No stories yet
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Check back soon for new stories
          </p>
        </div>
      </div>
    );
  }

  // Success state - render story reader with initial slug
  return <StoryReader stories={stories} initialSlug={slug} />;
}

