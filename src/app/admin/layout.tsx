import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin - Nuo Stories',
  description: 'Admin dashboard for Nuo Stories',
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Nuo Stories Admin
            </h1>
            <div className="flex gap-6">
              <Link
                href="/admin/add-article"
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Add Article
              </Link>
              <Link
                href="/"
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                View Site
              </Link>
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}

