'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function AdminPage() {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const handleCleanupStale = async () => {
    setIsCleaningUp(true);
    setCleanupMessage(null);

    try {
      const response = await fetch('/api/ingestion-jobs/cleanup-stale', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cleanup stale jobs');
      }

      setCleanupMessage(`✅ ${data.message}`);
    } catch (error) {
      setCleanupMessage(`❌ ${error instanceof Error ? error.message : 'An error occurred'}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-8 py-16">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage your Nuo Stories content
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/add-article"
            className="group rounded-lg border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-50"
          >
            <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-200">
              Add Article via URL
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Generate a story draft from an article URL
            </p>
          </Link>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Cleanup Stale Jobs
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Mark jobs stuck in GENERATING for &gt;10 minutes as FAILED
            </p>
            <button
              onClick={handleCleanupStale}
              disabled={isCleaningUp}
              className={[
                'mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white',
                'transition-colors hover:bg-orange-700',
                'disabled:cursor-not-allowed disabled:opacity-50',
              ].join(' ')}
            >
              {isCleaningUp ? 'Cleaning up...' : 'Run Cleanup'}
            </button>
            {cleanupMessage && (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                {cleanupMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

