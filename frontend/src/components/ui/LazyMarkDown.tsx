import { lazy, Suspense } from 'react';

const MarkDown = lazy(() => import('./MarkDown'));

interface LazyMarkDownProps {
  content: string;
  className?: string;
}

export function LazyMarkDown({ content, className }: LazyMarkDownProps) {
  return (
    <Suspense
      fallback={
        <div className={`whitespace-pre-wrap text-sm ${className ?? ''}`.trim()}>{content}</div>
      }
    >
      <MarkDown content={content} className={className} />
    </Suspense>
  );
}
