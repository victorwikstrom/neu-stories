'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { StoryCard } from './StoryCard';
import { StoryIndicators } from './StoryIndicators';
import type { Story } from '@/lib/story-schema';

type StoryReaderProps = {
  stories: Story[];
  initialSlug?: string;
};

const SWIPE_THRESHOLD = 50;
const SWIPE_CONFIDENCE_THRESHOLD = 10000;
const VERTICAL_SWIPE_THRESHOLD = 80; // Higher threshold for vertical to avoid accidental triggers

export function StoryReader({ stories, initialSlug }: StoryReaderProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!initialSlug) return 0;
    const index = stories.findIndex((story) => story.slug === initialSlug);
    return index >= 0 ? index : 0;
  });
  const [direction, setDirection] = useState(0);

  const canGoNext = currentIndex < stories.length - 1;
  const canGoPrev = currentIndex > 0;
  const currentStory = stories[currentIndex];

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [canGoNext]);

  const goToPrev = useCallback(() => {
    if (canGoPrev) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [canGoPrev]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        router.push(`/stories/${currentStory.slug}/depth`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, router, currentStory.slug]);

  // Handle swipe gesture
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const { offset, velocity } = info;
    
    // Determine if this is primarily a horizontal or vertical gesture
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);
    
    // Vertical swipe detection (downward)
    // Only trigger if vertical movement is dominant and exceeds threshold
    if (absY > absX && offset.y > VERTICAL_SWIPE_THRESHOLD) {
      // Navigate to depth view
      router.push(`/stories/${currentStory.slug}/depth`);
      return;
    }
    
    // Horizontal swipe detection (left/right for story navigation)
    // Only process if horizontal movement is dominant
    if (absX > absY) {
      const swipe = absX * velocity.x;
      
      if (swipe < -SWIPE_CONFIDENCE_THRESHOLD || offset.x < -SWIPE_THRESHOLD) {
        goToNext();
      } else if (swipe > SWIPE_CONFIDENCE_THRESHOLD || offset.x > SWIPE_THRESHOLD) {
        goToPrev();
      }
    }
  };

  // Handle click on left/right zones
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickZone = rect.width / 2;

    if (x < clickZone) {
      goToPrev();
    } else {
      goToNext();
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <main 
      className="relative h-screen w-screen overflow-hidden bg-black"
      style={{
        height: '100dvh',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'none',
      }}
      aria-label="Story reader"
    >
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentStory.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="absolute inset-0"
          style={{ 
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          <div 
            onClick={handleClick} 
            className="h-full w-full cursor-pointer touch-none"
            role="button"
            tabIndex={0}
            aria-label={`Navigate stories. Currently viewing: ${currentStory.headline}. Press left arrow for previous, right arrow for next, down arrow for depth view.`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goToNext();
              }
            }}
          >
            <StoryCard
              headline={currentStory.headline}
              summary={currentStory.summary}
              heroImageUrl={currentStory.heroImage?.url}
              heroImageAlt={currentStory.heroImage?.alt}
              slug={currentStory.slug}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress indicators */}
      <StoryIndicators total={stories.length} currentIndex={currentIndex} />

      {/* Navigation hint zones */}
      <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
        <div className="w-1/2" />
        <div className="w-1/2" />
      </div>
    </main>
  );
}

