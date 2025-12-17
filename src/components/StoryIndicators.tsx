'use client';

type StoryIndicatorsProps = {
  total: number;
  currentIndex: number;
};

const MAX_INDICATORS = 10;

export function StoryIndicators({ total, currentIndex }: StoryIndicatorsProps) {
  // Calculate the window of indicators to show
  const getIndicatorWindow = () => {
    if (total <= MAX_INDICATORS) {
      // Show all indicators if total is less than max
      return { start: 0, end: total };
    }

    // Calculate sliding window
    const halfWindow = Math.floor(MAX_INDICATORS / 2);
    let start = currentIndex - halfWindow;
    let end = currentIndex + halfWindow;

    // Adjust if window goes below 0
    if (start < 0) {
      start = 0;
      end = MAX_INDICATORS;
    }
    // Adjust if window goes beyond total
    else if (end > total) {
      end = total;
      start = total - MAX_INDICATORS;
    }

    return { start, end };
  };

  const { start, end } = getIndicatorWindow();
  const indicators = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <nav 
      className="absolute left-0 right-0 top-0 z-10 flex items-center justify-center gap-1 px-4 py-4"
      aria-label="Story progress"
      role="navigation"
    >
      <div className="flex gap-1" role="list" aria-label={`Story ${currentIndex + 1} of ${total}`}>
        {indicators.map((index) => (
          <div
            key={index}
            role="listitem"
            aria-label={`Story ${index + 1}${index === currentIndex ? ' (current)' : ''}`}
            className={[
              'h-1 rounded-full transition-all duration-200',
              index === currentIndex
                ? 'w-8 bg-white'
                : 'w-8 bg-white/40',
            ].join(' ')}
          />
        ))}
      </div>
    </nav>
  );
}

