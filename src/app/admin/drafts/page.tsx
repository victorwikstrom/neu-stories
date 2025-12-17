'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Source = {
  id: string;
  url: string;
  label: string;
  domain: string;
  type: string;
};

type Story = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  status: string;
  primarySources: Source[];
  createdAt: string;
};

export default function DraftsPage() {
  const searchParams = useSearchParams();
  const successMessage = searchParams.get('success');
  
  const [drafts, setDrafts] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(!!successMessage);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/stories/drafts');
        
        if (!response.ok) {
          throw new Error('Failed to fetch drafts');
        }
        
        const data: Story[] = await response.json();
        setDrafts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrafts();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const getSourceDomain = (story: Story): string => {
    if (story.primarySources.length > 0) {
      return story.primarySources[0].domain;
    }
    return '—';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-8 py-16">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-8 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-16">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Draft Stories
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'} waiting for review
          </p>
        </div>

        {showSuccess && successMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              ✓ {successMessage}
            </p>
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              No draft stories found.
            </p>
            <Link
              href="/admin/add-article"
              className="mt-4 inline-block text-sm font-medium text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              Add an article to get started →
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Headline
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Source domain
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Created at
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => (
                    <tr
                      key={draft.id}
                      className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                    >
                      <td className="px-6 py-4">
                        <div className="max-w-md">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {draft.headline}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                            {draft.summary}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">
                          {getSourceDomain(draft)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">
                          {formatDate(draft.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/drafts/${draft.id}`}
                          className={[
                            'inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white',
                            'transition-colors hover:bg-zinc-700',
                            'dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
                          ].join(' ')}
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

