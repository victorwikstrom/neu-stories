'use client';

import { useState } from 'react';

type JobStatus = 'QUEUED' | 'FETCHING' | 'EXTRACTING' | 'EXTRACTED' | 'READY_TO_GENERATE' | 'GENERATING' | 'SAVED' | 'FAILED';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setJobId(null);
    setJobStatus(null);
    setStorySlug(null);

    try {
      // Step 1: Create job
      setJobStatus('QUEUED');
      const createResponse = await fetch('/api/ingestion-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create ingestion job');
      }

      const job: IngestionJobResponse = await createResponse.json();
      setJobId(job.id);
      setJobStatus(job.status);

      // Step 2: Fetch - await completion
      setJobStatus('FETCHING');
      const fetchResponse = await fetch(`/api/ingestion-jobs/${job.id}/fetch`, {
        method: 'POST',
      });

      if (!fetchResponse.ok) {
        const error = await fetchResponse.json();
        throw new Error(error.error || 'Failed to fetch article');
      }

      const fetchResult = await fetchResponse.json();
      setJobStatus(fetchResult.job.status);

      // Step 3: Wait for extraction to complete (fetch auto-triggers it)
      // Poll job until status is READY_TO_GENERATE or extractedAt exists
      setJobStatus('EXTRACTING');
      let extractionComplete = false;
      const maxPolls = 30; // 30 seconds max
      let pollCount = 0;

      while (!extractionComplete && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        pollCount++;

        const pollResponse = await fetch(`/api/ingestion-jobs/${job.id}`);
        if (!pollResponse.ok) {
          throw new Error('Failed to poll job status');
        }

        const pollResult = await pollResponse.json();
        setJobStatus(pollResult.status);

        // Check if extraction is complete
        if (pollResult.status === 'READY_TO_GENERATE' || 
            pollResult.status === 'EXTRACTED' ||
            pollResult.extractedAt) {
          extractionComplete = true;
        } else if (pollResult.status === 'FAILED') {
          throw new Error(pollResult.errorMessage || 'Extraction failed');
        }
      }

      if (!extractionComplete) {
        throw new Error('Extraction timeout - took longer than expected');
      }

      // Step 4: Generate - only after extraction is complete
      setJobStatus('GENERATING');
      const generateResponse = await fetch(`/api/ingestion-jobs/${job.id}/generate`, {
        method: 'POST',
      });

      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        throw new Error(error.error || 'Failed to generate story');
      }

      const generateResult = await generateResponse.json();
      setJobStatus(generateResult.job.status);
      
      if (generateResult.story?.slug) {
        setStorySlug(generateResult.story.slug);
      }

    } catch (error) {
      setJobStatus('FAILED');
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
      EXTRACTED: 'Extraction complete',
      READY_TO_GENERATE: 'Ready to generate',
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

              {jobStatus === 'SAVED' && jobId && (
                <div className="mt-4 rounded-md bg-green-50 p-4 dark:bg-green-950/20">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Story created successfully!
                  </p>
                  <a
                    href={`/admin/jobs/${jobId}`}
                    className="mt-2 inline-block text-sm font-medium text-green-700 underline hover:text-green-600 dark:text-green-300 dark:hover:text-green-200"
                  >
                    View job & draft story →
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

