'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Source = {
  id: string;
  url: string;
  label: string;
  domain: string;
  type: string;
};

type Section = {
  id: string;
  type: 'what_happened' | 'background' | 'related';
  title?: string;
  body: string;
  order: number;
  sourceIds?: string[];
};

type Story = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  status: string;
  sections: Section[];
  primarySources: Source[];
  createdAt: string;
  updatedAt: string;
};

type EditableSection = Section & {
  sources: Source[];
  newSourceUrl: string;
};

const SECTION_TYPE_LABELS: Record<string, string> = {
  what_happened: 'Vad hände',
  background: 'Bakgrund',
  related: 'Relaterat',
};

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return date.toLocaleDateString();
}

export default function DraftEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [allSources, setAllSources] = useState<Source[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/drafts/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch story');
        }
        
        const data: Story = await response.json();
        setStory(data);
        setHeadline(data.headline);
        setSummary(data.summary);
        setAllSources(data.primarySources);
        setLastSavedAt(new Date(data.updatedAt));
        
        const editableSections: EditableSection[] = data.sections.map(section => {
          const sectionSources = (section.sourceIds ?? [])
            .map(sourceId => data.primarySources.find(s => s.id === sourceId))
            .filter((s): s is Source => s !== undefined);
          
          return {
            ...section,
            sources: sectionSources,
            newSourceUrl: '',
          };
        });
        
        setSections(editableSections);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchStory();
    }
  }, [id]);

  const handleSectionBodyChange = (sectionId: string, newBody: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, body: newBody } : s
    ));
    setHasUnsavedChanges(true);
  };

  const handleAddSource = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || !section.newSourceUrl.trim()) return;

    try {
      const response = await fetch('/api/sources/from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: section.newSourceUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create source');
      }

      const newSource: Source = await response.json();

      if (!allSources.find(s => s.id === newSource.id)) {
        setAllSources([...allSources, newSource]);
      }

      const updatedSections = sections.map(s => {
        if (s.id === sectionId) {
          const updatedSources = [...s.sources];
          if (!updatedSources.find(src => src.id === newSource.id)) {
            updatedSources.push(newSource);
          }
          return {
            ...s,
            sources: updatedSources,
            newSourceUrl: '',
          };
        }
        return s;
      });
      
      setSections(updatedSections);
      setHasUnsavedChanges(true);

      // Clear section error if source was added
      if (sectionErrors[sectionId]) {
        const newErrors = { ...sectionErrors };
        delete newErrors[sectionId];
        setSectionErrors(newErrors);
      }
      
      // Re-validate to update validation errors
      setValidationErrors([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source');
    }
  };

  const handleRemoveSource = (sectionId: string, sourceId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId 
        ? { ...s, sources: s.sources.filter(src => src.id !== sourceId) }
        : s
    ));
    setHasUnsavedChanges(true);
    setValidationErrors([]);
  };

  const handleNewSourceUrlChange = (sectionId: string, url: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, newSourceUrl: url } : s
    ));
  };

  const markUnsaved = () => setHasUnsavedChanges(true);

  const validate = useCallback((strict = false): string[] => {
    const errors: string[] = [];

    if (!headline.trim()) {
      errors.push('Headline is required');
    }

    sections.forEach((section, index) => {
      if (!section.body.trim()) {
        errors.push(`Section ${index + 1} (${SECTION_TYPE_LABELS[section.type]}) cannot be empty`);
      }

      if (strict && section.sources.length === 0) {
        errors.push(`Section ${index + 1} (${SECTION_TYPE_LABELS[section.type]}) must have at least one source`);
      }
    });

    return errors;
  }, [headline, sections]);

  const handleSave = useCallback(async (isAutosave = false) => {
    if (!hasUnsavedChanges && isAutosave) return;
    
    if (!isAutosave) setSaveSuccess(false);
    const errors = validate(false);
    
    if (errors.length > 0) {
      if (!isAutosave) setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setSectionErrors({});
    setIsSaving(true);
    setError(null);

    try {
      const updatePayload = {
        headline,
        summary,
        sections: sections.map(s => ({
          type: s.type,
          title: s.title,
          body: s.body,
          order: s.order,
          sourceIds: s.sources.map(src => src.id),
        })),
      };

      const response = await fetch(`/api/drafts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save draft');
      }

      const updatedStory: Story = await response.json();
      setStory(updatedStory);
      setAllSources(updatedStory.primarySources);
      
      // Update sections state with the saved data from server
      const editableSections: EditableSection[] = updatedStory.sections.map(section => {
        const sectionSources = (section.sourceIds ?? [])
          .map(sourceId => updatedStory.primarySources.find(s => s.id === sourceId))
          .filter((s): s is Source => s !== undefined);
        
        return {
          ...section,
          sources: sectionSources,
          newSourceUrl: '',
        };
      });
      setSections(editableSections);
      
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      
      if (!isAutosave) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      if (!isAutosave) {
        setError(err instanceof Error ? err.message : 'Failed to save draft');
      }
    } finally {
      setIsSaving(false);
    }
  }, [id, hasUnsavedChanges, headline, summary, sections, validate]);

  const handlePublish = useCallback(async () => {
    const errors = validate(false);
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      setError('Please fix validation errors before publishing');
      return;
    }

    if (!confirm('Are you sure you want to publish this story? It will be visible to all users.')) {
      return;
    }

    setValidationErrors([]);
    setSectionErrors({});
    setIsPublishing(true);
    setError(null);

    try {
      const response = await fetch(`/api/drafts/${id}/publish`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle structured validation errors
        if (errorData.code === 'VALIDATION_ERROR' && errorData.sectionErrors) {
          const sectionErrorMap: Record<string, string> = {};
          errorData.sectionErrors.forEach((err: { sectionId: string; message: string }) => {
            sectionErrorMap[err.sectionId] = err.message;
          });
          setSectionErrors(sectionErrorMap);
          setError(errorData.error || 'Validation failed');
        } else {
          setError(errorData.error || 'Failed to publish story');
        }
        return;
      }

      router.push('/admin/drafts?success=Story published successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish story');
    } finally {
      setIsPublishing(false);
    }
  }, [id, validate, router]);

  const handleDiscard = useCallback(async () => {
    if (!confirm('Are you sure you want to discard this story? This action cannot be undone.')) {
      return;
    }

    setIsDiscarding(true);
    setError(null);

    try {
      const response = await fetch(`/api/drafts/${id}/discard`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to discard story');
      }

      router.push('/admin/drafts?success=Story discarded successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard story');
    } finally {
      setIsDiscarding(false);
    }
  }, [id, router]);

  // Keyboard shortcut: Cmd/Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving && !isPublishing && !isDiscarding) {
          handleSave(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, isPublishing, isDiscarding, handleSave]);

  // Autosave every 8 seconds when dirty
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autosaveInterval = setInterval(() => {
      if (hasUnsavedChanges && !isSaving && !isPublishing && !isDiscarding) {
        handleSave(true);
      }
    }, 8000);

    return () => clearInterval(autosaveInterval);
  }, [hasUnsavedChanges, isSaving, isPublishing, isDiscarding, handleSave]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-16">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        </div>
      </div>
    );
  }

  if (error && !story) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-16">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Story not found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl  px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Story info and status */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link
                href="/admin/drafts"
                className="flex-shrink-0 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                ← Drafts
              </Link>
              <div className="h-4 w-px flex-shrink-0 bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex flex-col items-start gap-2">
              <h1 className="min-w-0 truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {story.headline}
              </h1>
              <span className="flex-shrink-1 truncate text-xs text-zinc-500 dark:text-zinc-500">
                {story.slug}
              </span>
              </div>
              
              
            </div>

            {/* Right: Action buttons */}
            <div className="flex  gap-2">
              <div className="mr-2">
              {hasUnsavedChanges && (
                <span className="flex-shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                  Unsaved changes
                </span>
              )}
              {!hasUnsavedChanges && lastSavedAt && (
                <span className="flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-500">
                  Saved {formatRelativeTime(lastSavedAt)}
                </span>
              )}
              </div>
            
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving || isPublishing || isDiscarding}
                className={[
                  'rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white',
                  'transition-colors hover:bg-zinc-700',
                  'dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {isSaving ? 'Saving...' : 'Save'}
                {!isSaving && (
                  <span className="ml-1.5 text-xs opacity-60">⌘S</span>
                )}
              </button>

              <button
                onClick={handlePublish}
                disabled={isSaving || isPublishing || isDiscarding}
                className={[
                  'rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white',
                  'transition-colors hover:bg-green-700',
                  'dark:bg-green-600 dark:hover:bg-green-700',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </button>

              <button
                onClick={handleDiscard}
                disabled={isSaving || isPublishing || isDiscarding}
                className={[
                  'rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white',
                  'transition-colors hover:bg-red-700',
                  'dark:bg-red-600 dark:hover:bg-red-700',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {isDiscarding ? 'Discarding...' : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="space-y-6">
          {validationErrors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
              Validation Errors:
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {validationErrors.map((err, idx) => (
                <li key={idx} className="text-sm text-red-700 dark:text-red-300">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && story && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {error}
            </p>
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              ✓ Draft saved successfully!
            </p>
          </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Basic Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="headline" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Headline *
                </label>
                <input
                  id="headline"
                  type="text"
                  value={headline}
                  onChange={(e) => {
                    setHeadline(e.target.value);
                    markUnsaved();
                  }}
                  className={[
                    'mt-2 w-full rounded-lg border border-zinc-300 px-4 py-3',
                    'bg-white text-zinc-900',
                    'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                    'focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20',
                  ].join(' ')}
                />
              </div>

              <div>
                <label htmlFor="summary" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Summary
                </label>
                <textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    markUnsaved();
                  }}
                  rows={3}
                  className={[
                    'mt-2 w-full rounded-lg border border-zinc-300 px-4 py-3',
                    'bg-white text-zinc-900',
                    'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                    'focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20',
                  ].join(' ')}
                />
              </div>
            </div>
          </div>

          {sections.map((section) => (
            <div
              key={section.id}
              className={[
                'rounded-lg border p-6',
                sectionErrors[section.id]
                  ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                  : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
              ].join(' ')}
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {SECTION_TYPE_LABELS[section.type] || section.type}
                </h2>
                {sectionErrors[section.id] && (
                  <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                    ⚠ {sectionErrors[section.id]}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor={`section-${section.id}`} className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Content *
                  </label>
                  <textarea
                    id={`section-${section.id}`}
                    value={section.body}
                    onChange={(e) => handleSectionBodyChange(section.id, e.target.value)}
                    rows={4}
                    className={[
                      'mt-2 w-full rounded-lg border border-zinc-300 px-4 py-3',
                      'bg-white text-zinc-900',
                      'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                      'focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20',
                    ].join(' ')}
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Sources ({section.sources.length})
                  </h3>
                  
                  {section.sources.length > 0 && (
                    <ul className="mb-3 space-y-2">
                      {section.sources.map((source) => (
                        <li
                          key={source.id}
                          className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          <div className="flex-1">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {source.label} ({source.domain})
                            </a>
                          </div>
                          <button
                            onClick={() => handleRemoveSource(section.id, source.id)}
                            className="ml-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={section.newSourceUrl}
                      onChange={(e) => handleNewSourceUrlChange(section.id, e.target.value)}
                      placeholder="https://example.com/article"
                      className={[
                        'flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm',
                        'bg-white text-zinc-900',
                        'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                        'focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20',
                      ].join(' ')}
                    />
                    <button
                      onClick={() => handleAddSource(section.id)}
                      disabled={!section.newSourceUrl.trim()}
                      className={[
                        'rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white',
                        'transition-colors hover:bg-zinc-700',
                        'dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      ].join(' ')}
                    >
                      Add Source
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

