'use client';

import { useEffect, useState } from 'react';

type ToastProps = {
  message: string;
  duration?: number;
  onClose: () => void;
};

export function Toast({ message, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in
    setIsVisible(true);

    // Auto dismiss
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={[
        'fixed bottom-8 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-zinc-900 px-6 py-3 text-sm text-white shadow-lg transition-opacity duration-300 dark:bg-zinc-50 dark:text-zinc-900',
        isVisible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

