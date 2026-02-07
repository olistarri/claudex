import { memo, useMemo } from 'react';
import fuzzysort from 'fuzzysort';
import { cn } from '@/utils/cn';

export interface HighlightMatchProps {
  text: string;
  searchQuery: string;
  className?: string;
}

interface HighlightTextSegment {
  text: string;
  highlighted: boolean;
}

export const HighlightMatch = memo(function HighlightMatch({
  text,
  searchQuery,
  className,
}: HighlightMatchProps) {
  const segments = useMemo((): HighlightTextSegment[] => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      return [{ text, highlighted: false }];
    }

    const result = fuzzysort.single(trimmedQuery, text);

    if (!result || !result.indexes) {
      return [{ text, highlighted: false }];
    }

    const highlightedIndexes = new Set(result.indexes);
    const textSegments: HighlightTextSegment[] = [];
    let currentSegment = '';
    let isHighlighted = false;

    for (let i = 0; i < text.length; i++) {
      const shouldHighlight = highlightedIndexes.has(i);

      if (shouldHighlight !== isHighlighted) {
        if (currentSegment) {
          textSegments.push({ text: currentSegment, highlighted: isHighlighted });
        }
        currentSegment = text[i];
        isHighlighted = shouldHighlight;
      } else {
        currentSegment += text[i];
      }
    }

    if (currentSegment) {
      textSegments.push({ text: currentSegment, highlighted: isHighlighted });
    }

    return textSegments;
  }, [text, searchQuery]);

  return (
    <span className={cn('truncate', className)}>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={index}
            className="rounded-sm bg-surface-active px-0.5 font-medium text-text-primary dark:bg-surface-dark-hover dark:text-text-dark-primary"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  );
});
