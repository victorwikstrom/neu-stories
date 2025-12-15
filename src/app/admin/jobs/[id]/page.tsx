'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type JobStatus = 'QUEUED' | 'FETCHING' | 'EXTRACTING' | 'EXTRACTED' | 'READY_TO_GENERATE' | 'GENERATING' | 'SAVED' | 'FAILED';

type Section = {
  id: string;
  type: string;
  title: string | null;
  body: string;
  order: number;
};

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
  sections: Section[];
  primarySources: Source[];
  tags: string[];
  promptVersion: string | null;
  modelName: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobData = {
  id: string;
  url: string;
  status: JobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  fetchedAt: string | null;
  extractedAt: string | null;
  generatedAt: string | null;
  httpStatus: number | null;
  contentType: string | null;
  extractedTitle: string | null;
  extractedText: string | null;
  storyId: string | null;
  story: Story | null;
  manuallyProvided: boolean;
};

export default function JobReviewPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [showRawJSON, setShowRawJSON] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const fetchJobData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/ingestion-jobs/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job data');
      }
      const data: JobData = await response.json();
      setJobData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchJobData();
    }
  }, [id]);

  const handleRegenerate = async () => {
    if (!id) return;
    
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/ingestion-jobs/${id}/regenerate`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate story');
      }
      
      // Refresh the job data
      await fetchJobData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!id) return;
    
    if (!manualTitle.trim() || !manualText.trim()) {
      setError('Both title and text are required');
      return;
    }
    
    setIsSubmittingManual(true);
    setError(null);
    
    try {
      // Submit manual content
      const response = await fetch(`/api/ingestion-jobs/${id}/manual-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: manualTitle,
          text: manualText,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit manual content');
      }
      
      // Now trigger generation
      const generateResponse = await fetch(`/api/ingestion-jobs/${id}/generate`, {
        method: 'POST',
      });
      
      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        throw new Error(error.error || 'Failed to generate story');
      }
      
      // Refresh the job data
      await fetchJobData();
      setShowManualInput(false);
      setManualTitle('');
      setManualText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const getStatusColor = (status: JobStatus) => {
    if (status === 'SAVED') return 'text-green-600 dark:text-green-400';
    if (status === 'FAILED') return 'text-red-600 dark:text-red-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const getStatusDisplay = (status: JobStatus) => {
    const statusMap = {
      QUEUED: 'Queued',
      FETCHING: 'Fetching',
      EXTRACTING: 'Extracting',
      EXTRACTED: 'Extracted',
      READY_TO_GENERATE: 'Ready to Generate',
      GENERATING: 'Generating',
      SAVED: 'Saved',
      FAILED: 'Failed',
    };
    return statusMap[status] || status;
  };

  const isJobStale = (job: JobData): boolean => {
    if (job.status !== 'GENERATING') return false;
    const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
    const updatedAt = new Date(job.updatedAt);
    return Date.now() - updatedAt.getTime() > STALE_THRESHOLD_MS;
  };

  const getRawJSON = (story: Story | null) => {
    if (!story) return null;
    
    // Reconstruct the draft format from story sections
    const whatHappened = story.sections
      .filter(s => s.type === 'WHAT_HAPPENED')
      .sort((a, b) => a.order - b.order)
      .map(s => s.body);
    
    const background = story.sections
      .filter(s => s.type === 'BACKGROUND')
      .sort((a, b) => a.order - b.order)
      .map(s => s.body);
    
    return {
      headline: story.headline,
      short_summary: story.summary,
      what_happened: whatHappened,
      background: background,
      evidence: [], // Evidence is not stored in the story model
    };
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-16">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        </div>
      </div>
    );
  }

  if (error || !jobData) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error || 'Job not found'}
          </p>
        </div>
      </div>
    );
  }

  const rawJSON = getRawJSON(jobData.story);

  return (
    <div className="mx-auto max-w-5xl px-8 py-16">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Job Review
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Review ingestion job and generated draft
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Job Info */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Job Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">URL:</span>
              <p className="mt-1 break-all text-sm text-zinc-900 dark:text-zinc-100">
                <a
                  href={jobData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {jobData.url}
                </a>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status:</span>
              <span className={['text-sm font-medium', getStatusColor(jobData.status)].join(' ')}>
                {getStatusDisplay(jobData.status)}
              </span>
              {isJobStale(jobData) && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                  STALE
                </span>
              )}
            </div>
            {jobData.errorMessage && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-950/20">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error: {jobData.errorMessage}
                </p>
              </div>
            )}
            {jobData.manuallyProvided && (
              <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-950/20">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  ℹ️ Content was manually provided
                </p>
              </div>
            )}
            {isJobStale(jobData) && (
              <div className="rounded-md bg-orange-50 p-4 dark:bg-orange-950/20">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  ⚠️ This job has been stuck in GENERATING for more than 10 minutes. It may be stale and should be retried.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">Created:</span>
                <p className="text-zinc-900 dark:text-zinc-100">
                  {new Date(jobData.createdAt).toLocaleString()}
                </p>
              </div>
              {jobData.generatedAt && (
                <div>
                  <span className="font-medium text-zinc-600 dark:text-zinc-400">Generated:</span>
                  <p className="text-zinc-900 dark:text-zinc-100">
                    {new Date(jobData.generatedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual Content Input */}
        {(jobData.status === 'FAILED' || jobData.status === 'QUEUED' || jobData.status === 'FETCHING' || jobData.status === 'EXTRACTING' || jobData.status === 'EXTRACTED' || jobData.status === 'READY_TO_GENERATE') && !jobData.extractedText && (
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="flex w-full items-center justify-between p-6 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Paste Content Manually
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  If extraction failed or you prefer, paste the article content directly
                </p>
              </div>
              <span className="text-zinc-600 dark:text-zinc-400">
                {showManualInput ? '−' : '+'}
              </span>
            </button>
            {showManualInput && (
              <div className="border-t border-zinc-200 p-6 dark:border-zinc-800">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="manual-title" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Article Title
                    </label>
                    <input
                      id="manual-title"
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Enter article title..."
                      className={[
                        'mt-2 w-full rounded-lg border border-zinc-300 px-4 py-2',
                        'bg-white text-zinc-900',
                        'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                        'focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20',
                      ].join(' ')}
                    />
                  </div>
                  <div>
                    <label htmlFor="manual-text" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Article Text
                    </label>
                    <textarea
                      id="manual-text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Paste article text here..."
                      rows={12}
                      className={[
                        'mt-2 w-full rounded-lg border border-zinc-300 px-4 py-2',
                        'bg-white text-zinc-900',
                        'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                        'focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20',
                        'font-mono text-sm',
                      ].join(' ')}
                    />
                  </div>
                  <button
                    onClick={handleManualSubmit}
                    disabled={isSubmittingManual || !manualTitle.trim() || !manualText.trim()}
                    className={[
                      'w-full rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white',
                      'transition-colors hover:bg-zinc-700',
                      'dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    ].join(' ')}
                  >
                    {isSubmittingManual ? 'Processing...' : 'Submit & Generate Draft'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extracted Text Panel */}
        {jobData.extractedText && (
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setShowExtractedText(!showExtractedText)}
              className="flex w-full items-center justify-between p-6 text-left"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Extracted Text
              </h2>
              <span className="text-zinc-600 dark:text-zinc-400">
                {showExtractedText ? '−' : '+'}
              </span>
            </button>
            {showExtractedText && (
              <div className="border-t border-zinc-200 p-6 dark:border-zinc-800">
                {jobData.extractedTitle && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Title:
                    </h3>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {jobData.extractedTitle}
                    </p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Content:
                  </h3>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-4 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {jobData.extractedText}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Raw AI JSON Panel */}
        {rawJSON && (
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setShowRawJSON(!showRawJSON)}
              className="flex w-full items-center justify-between p-6 text-left"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Raw AI JSON
              </h2>
              <span className="text-zinc-600 dark:text-zinc-400">
                {showRawJSON ? '−' : '+'}
              </span>
            </button>
            {showRawJSON && (
              <div className="border-t border-zinc-200 p-6 dark:border-zinc-800">
                <pre className="max-h-96 overflow-auto rounded bg-zinc-50 p-4 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                  {JSON.stringify(rawJSON, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Story Preview */}
        {jobData.story && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Draft Story Preview
              </h2>
              <span className={[
                'rounded-full px-3 py-1 text-xs font-medium',
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
              ].join(' ')}>
                {jobData.story.status.toUpperCase()}
              </span>
            </div>

            {/* Story Content */}
            <div className="space-y-6">
              {/* Headline */}
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {jobData.story.headline}
                </h1>
              </div>

              {/* Summary */}
              <div className="border-l-4 border-zinc-300 pl-4 dark:border-zinc-700">
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {jobData.story.summary}
                </p>
              </div>

              {/* What Happened Section */}
              {jobData.story.sections.filter(s => s.type === 'WHAT_HAPPENED').length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Vad hände
                  </h2>
                  <ul className="space-y-2">
                    {jobData.story.sections
                      .filter(s => s.type === 'WHAT_HAPPENED')
                      .sort((a, b) => a.order - b.order)
                      .map((section) => (
                        <li key={section.id} className="flex gap-3">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                          <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                            {section.body}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Background Section */}
              {jobData.story.sections.filter(s => s.type === 'BACKGROUND').length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Bakgrund
                  </h2>
                  <ul className="space-y-2">
                    {jobData.story.sections
                      .filter(s => s.type === 'BACKGROUND')
                      .sort((a, b) => a.order - b.order)
                      .map((section) => (
                        <li key={section.id} className="flex gap-3">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                          <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                            {section.body}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Sources */}
              {jobData.story.primarySources.length > 0 && (
                <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <h3 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    Källor
                  </h3>
                  <ul className="space-y-1">
                    {jobData.story.primarySources.map((source) => (
                      <li key={source.id}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {source.label} ({source.domain})
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata */}
              {jobData.story.modelName && (
                <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Generated by {jobData.story.modelName}
                    {jobData.story.promptVersion && ` (${jobData.story.promptVersion})`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {jobData.extractedText && (
          <div className="flex gap-4">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className={[
                'rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white',
                'transition-colors hover:bg-zinc-700',
                'dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
                'disabled:cursor-not-allowed disabled:opacity-50',
              ].join(' ')}
            >
              {isRegenerating ? 'Regenerating...' : (jobData.status === 'FAILED' || isJobStale(jobData) ? 'Retry Generation' : 'Regenerate Draft')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

