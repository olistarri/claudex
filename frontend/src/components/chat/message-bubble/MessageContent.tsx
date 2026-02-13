import { memo } from 'react';
import { MessageRenderer } from './MessageRenderer';
import type { AssistantStreamEvent, MessageAttachment } from '@/types';
import { MessageAttachments } from './MessageAttachments';

interface MessageContentProps {
  contentText: string;
  contentRender?: {
    events?: AssistantStreamEvent[];
  };
  isBot: boolean;
  attachments?: MessageAttachment[];
  uploadingAttachmentIds?: string[];
  isStreaming: boolean;
  chatId?: string;
  isLastBotMessage?: boolean;
  onSuggestionSelect?: (suggestion: string) => void;
}

export const MessageContent = memo(
  ({
    contentText,
    contentRender,
    isBot,
    attachments,
    uploadingAttachmentIds,
    isStreaming,
    chatId,
    isLastBotMessage,
    onSuggestionSelect,
  }: MessageContentProps) => {
    if (!isBot) {
      return (
        <div className="space-y-1">
          <MessageAttachments
            attachments={attachments}
            uploadingAttachmentIds={uploadingAttachmentIds}
          />
          <MessageRenderer
            contentText={contentText}
            events={contentRender?.events}
            isStreaming={isStreaming}
            chatId={chatId}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <MessageRenderer
          contentText={contentText}
          events={contentRender?.events}
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
