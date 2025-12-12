'use client';

import { useState, useEffect } from 'react';

type JobStatus = 'QUEUED' | 'FETCHING' | 'EXTRACTING' | 'GENERATING' | 'SAVED' | 'FAILED';

type IngestionJobResponse = {
  id: string;
  url: string;
  status: JobStatus;
  errorMessage?: string;
  createdAt: string;
  storySlug?: string;
};

export default function AddArticlePage() {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storySlug, setStorySlug] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || jobStatus === 'SAVED' || jobStatus === 'FAILED') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/ingestion-jobs/${jobId}`);
        if (response.ok) {
          const job: IngestionJobResponse = await response.json();
          setJobStatus(job.status);
          if (job.errorMessage) {
            setErrorMessage(job.errorMessage);
          }
          if (job.storySlug) {
            setStorySlug(job.storySlug);
          }
          if (job.status === 'SAVED' || job.status === 'FAILED') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId, jobStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setJobId(null);
    setJobStatus(null);
    setStorySlug(null);

    try {
      const response = await fetch('/api/ingestion-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create ingestion job');
      }

      const job: IngestionJobResponse = await response.json();
      setJobId(job.id);
      setJobStatus(job.status);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDisplay = (status: JobStatus) => {
    const statusMap = {
      QUEUED: 'Queued',
      FETCHING: 'Fetching article...',
      EXTRACTING: 'Extracting content...',
      GENERATING: 'Generating story...',
      SAVED: 'Saved',
      FAILED: 'Failed',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: JobStatus) => {
    if (status === 'SAVED') return 'text-green-600 dark:text-green-400';
    if (status === 'FAILED') return 'text-red-600 dark:text-red-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Add Article via URL
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Enter a URL to generate a story draft
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="url" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Article URL
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              disabled={isSubmitting || (jobStatus !== null && jobStatus !== 'FAILED')}
              className={[
                'rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900',
                'placeholder:text-zinc-400',
                'focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900',
                'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
                'dark:focus:border-zinc-50 dark:focus:ring-zinc-50',
                'disabled:cursor-not-allowed disabled:opacity-50',
              ].join(' ')}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || (jobStatus !== null && jobStatus !== 'FAILED')}
            className={[
              'rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white',
              'transition-colors hover:bg-zinc-700',
              'dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
          >
            {isSubmitting ? 'Creating Job...' : 'Generate'}
          </button>
        </form>

        {jobStatus && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Job Status
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Status:</span>
                <span className={['text-sm font-medium', getStatusColor(jobStatus)].join(' ')}>
                  {getStatusDisplay(jobStatus)}
                </span>
              </div>

              {jobStatus !== 'SAVED' && jobStatus !== 'FAILED' && (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Processing...</span>
                </div>
              )}

              {jobStatus === 'SAVED' && storySlug && (
                <div className="mt-4 rounded-md bg-green-50 p-4 dark:bg-green-950/20">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Story created successfully!
                  </p>
                  <a
                    href={`/admin/stories/${storySlug}`}
                    className="mt-2 inline-block text-sm font-medium text-green-700 underline hover:text-green-600 dark:text-green-300 dark:hover:text-green-200"
                  >
                    View draft story →
                  </a>
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 rounded-md bg-red-50 p-4 dark:bg-red-950/20">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {errorMessage}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

