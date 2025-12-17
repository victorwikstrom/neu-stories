'use client';

import Image from 'next/image';
import Link from 'next/link';

type StoryCardProps = {
  headline: string;
  summary: string;
  heroImageUrl?: string | null;
  heroImageAlt?: string;
  slug: string;
};

export function StoryCard({
  headline,
  summary,
  heroImageUrl,
  heroImageAlt,
  slug,
}: StoryCardProps) {
  return (
    <article className="h-screen w-screen flex flex-col bg-white dark:bg-zinc-900 relative">
      {/* Hero Image Section - Top Half */}
      <div className="relative h-1/2 w-full bg-zinc-100 dark:bg-zinc-800">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={heroImageAlt || ''}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <div className="text-zinc-400 dark:text-zinc-600">
              <svg
                className="h-24 w-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-label="No image available"
              >
                <title>Placeholder image icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Content Section - Bottom Half */}
      <div className="flex h-1/2 w-full flex-col justify-center px-6 py-8 sm:px-12 md:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-3xl">
          {/* Headline */}
          <h1 className="text-3xl font-bold leading-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl md:text-5xl lg:text-6xl">
            {headline}
          </h1>

          {/* Summary */}
          <p className="mt-6 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg md:text-xl">
            {summary}
          </p>
        </div>
      </div>

      {/* Down Arrow for Depth View */}
      <Link
        href={`/stories/${slug}/depth`}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/10 p-3 backdrop-blur-sm transition-all hover:bg-zinc-900/20 dark:bg-zinc-50/10 dark:hover:bg-zinc-50/20"
        onClick={(e) => e.stopPropagation()}
        aria-label="View depth analysis"
      >
        <svg
          className="h-6 w-6 text-zinc-900 dark:text-zinc-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </Link>
    </article>
  );
}

