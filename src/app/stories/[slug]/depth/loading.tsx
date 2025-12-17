export default function LoadingDepthView() {
  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div 
          className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50"
          aria-hidden="true"
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading depth view...
        </p>
      </div>
    </div>
  );
}

