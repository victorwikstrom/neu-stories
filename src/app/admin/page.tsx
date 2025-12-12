import Link from 'next/link';

export default function AdminPage() {
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
        </div>
      </div>
    </div>
  );
}

