import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublishedStoryWithDepth } from '@/server/queries/story';
import { DepthSections } from '@/components/DepthSections';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StoryDepthPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  const story = await getPublishedStoryWithDepth(slug);

  if (!story) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-900">
      {/* Header with back button */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <Link
            href={`/stories/${slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to story
          </Link>
        </div>
      </header>

      {/* Story Content */}
      <article className="mx-auto max-w-4xl px-6 py-12">
        {/* Headline */}
        <h1 className="text-4xl font-bold leading-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          {story.headline}
        </h1>

        {/* Sections with interactive save functionality */}
        <DepthSections sections={story.sections} />

        {/* Bottom spacing */}
        <div className="h-16" />
      </article>
    </main>
  );
}

