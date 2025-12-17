'use client';

import { useState, useEffect } from 'react';
import type { Story } from './story-schema';

export type FetchStoriesParams = {
  limit?: number;
  offset?: number;
};

export type StoriesState = {
  data: Story[] | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Fetches published stories from the API
 * @param params Query parameters (limit, offset)
 * @returns Array of Story objects
 */
export async function fetchStories(params: FetchStoriesParams = {}): Promise<Story[]> {
  const { limit = 20, offset = 0 } = params;
  
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await fetch(`/api/stories?${searchParams.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch stories: ${response.statusText}`);
  }

  const stories: Story[] = await response.json();
  return stories;
}

/**
 * React hook for fetching published stories
 * @param params Query parameters (limit, offset)
 * @returns State object with data, isLoading, and error
 */
export function useStories(params: FetchStoriesParams = {}): StoriesState {
  const [state, setState] = useState<StoriesState>({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadStories() {
      try {
        setState({ data: null, isLoading: true, error: null });
        const stories = await fetchStories(params);
        
        if (isMounted) {
          setState({ data: stories, isLoading: false, error: null });
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
          setState({ data: null, isLoading: false, error: errorMessage });
        }
      }
    }

    loadStories();

    return () => {
      isMounted = false;
    };
  }, [params.limit, params.offset]);

  return state;
}

