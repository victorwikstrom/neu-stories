'use client';

import Link from 'next/link';
import { BookmarkIcon } from '@radix-ui/react-icons';

export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-transparent">
      <div className="flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold text-white hover:text-white/80 transition-colors"
        >
          Nuo Stories
        </Link>
        
        <Link
          href="/reading-list"
          className="flex items-center justify-center rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/20"
          aria-label="Reading List"
        >
          <BookmarkIcon className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}

