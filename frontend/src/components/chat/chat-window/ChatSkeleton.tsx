import { memo } from 'react';

export interface MessageSkeletonProps {
  isBot?: boolean;
  className?: string;
}

export interface ChatSkeletonProps {
  messageCount?: number;
  className?: string;
}

const MessageSkeleton = memo(function MessageSkeleton({ className = '' }: MessageSkeletonProps) {
  return (
    <div className={`px-4 pt-6 sm:px-6 ${className}`}>
      <div className="flex gap-3 sm:gap-4">
        <div className="mt-1 flex-shrink-0">
          <div className="h-7 w-7 animate-pulse rounded-full bg-surface-hover dark:bg-surface-dark-tertiary" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-hover dark:bg-surface-dark-tertiary" />

          <div className="space-y-2.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-surface-hover dark:bg-surface-dark-tertiary" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-hover dark:bg-surface-dark-tertiary" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-surface-hover dark:bg-surface-dark-tertiary" />
          </div>
        </div>
      </div>
    </div>
  );
});

export const ChatSkeleton = memo(function ChatSkeleton({
  messageCount = 3,
  className = '',
}: ChatSkeletonProps) {
  return (
    <div className={`mx-auto max-w-4xl px-6 ${className}`}>
      {Array.from({ length: messageCount }).map((_, index) => (
        <MessageSkeleton
          key={index}
          isBot={index % 2 === 1}
          className={index === 0 ? 'mt-4' : ''}
        />
      ))}
    </div>
  );
});

export default ChatSkeleton;
