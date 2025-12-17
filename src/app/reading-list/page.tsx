'use client';

export default function ReadingListPage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Reading List
        </h1>
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
          Your saved stories will appear here
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          Feature coming soon
        </p>
      </div>
    </div>
  );
}

