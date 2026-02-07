import { memo } from 'react';
import { MessageRenderer } from './MessageRenderer';
import type { MessageAttachment } from '@/types';
import { MessageAttachments } from './MessageAttachments';

interface MessageContentProps {
  content: string;
  isBot: boolean;
  attachments?: MessageAttachment[];
  isStreaming: boolean;
  chatId?: string;
  isLastBotMessage?: boolean;
  onSuggestionSelect?: (suggestion: string) => void;
}

export const MessageContent = memo(
  ({
    content,
    isBot,
    attachments,
    isStreaming,
    chatId,
    isLastBotMessage,
    onSuggestionSelect,
  }: MessageContentProps) => {
    if (!isBot) {
      return (
        <div className="space-y-1">
          <MessageAttachments attachments={attachments} />
          <MessageRenderer content={content} isStreaming={isStreaming} chatId={chatId} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <MessageRenderer
          content={content}
          isStreaming={isStreaming}
          chatId={chatId}
          isLastBotMessage={isLastBotMessage}
          onSuggestionSelect={onSuggestionSelect}
        />

        <MessageAttachments attachments={attachments} className="mt-3" />
      </div>
    );
  },
);
