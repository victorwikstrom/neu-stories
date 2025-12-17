'use client';

import { useState } from 'react';
import { Toast } from './Toast';
import type { DepthSection } from '@/server/queries/story';

type DepthSectionsProps = {
  sections: DepthSection[];
};

export function DepthSections({ sections }: DepthSectionsProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [savingSourceId, setSavingSourceId] = useState<string | null>(null);

  const whatHappenedSection = sections.find(s => s.type === 'what_happened');
  const backgroundSection = sections.find(s => s.type === 'background');

  const handleSaveSource = async (sourceId: string) => {
    setSavingSourceId(sourceId);
    try {
      const response = await fetch('/api/reading-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      setToast('Saved to reading list 📚');
    } catch (error) {
      console.error('Error saving source:', error);
      setToast('Could not save');
    } finally {
      setSavingSourceId(null);
    }
  };

  return (
    <>
      {/* What Happened Section */}
      {whatHappenedSection && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {whatHappenedSection.title || 'What happened'}
          </h2>
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              {whatHappenedSection.body}
            </p>
          </div>

          {/* Sources for What Happened */}
          {whatHappenedSection.sources.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Sources
              </h3>
              <ul className="space-y-2">
                {whatHappenedSection.sources.map((source, index) => (
                  <li key={source.id} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="flex-1">
                      [{index + 1}] Source:{' '}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-300"
                      >
                        {source.label}
                      </a>
                    </span>
                    <button
                      onClick={() => handleSaveSource(source.id)}
                      disabled={savingSourceId === source.id}
                      className="flex-shrink-0 rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      aria-label={`Save ${source.label} to reading list`}
                    >
                      {savingSourceId === source.id ? 'Saving...' : 'Save'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Background Section */}
      {backgroundSection && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {backgroundSection.title || 'Background'}
          </h2>
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              {backgroundSection.body}
            </p>
          </div>

          {/* Sources for Background */}
          {backgroundSection.sources.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Sources
              </h3>
              <ul className="space-y-2">
                {backgroundSection.sources.map((source, index) => (
                  <li key={source.id} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="flex-1">
                      [{index + 1}] Source:{' '}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-300"
                      >
                        {source.label}
                      </a>
                    </span>
                    <button
                      onClick={() => handleSaveSource(source.id)}
                      disabled={savingSourceId === source.id}
                      className="flex-shrink-0 rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      aria-label={`Save ${source.label} to reading list`}
                      >
                      {savingSourceId === source.id ? 'Saving...' : 'Save'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

