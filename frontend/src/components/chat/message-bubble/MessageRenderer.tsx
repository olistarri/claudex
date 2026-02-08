import React, { memo } from 'react';
import { parseEventLog } from '@/utils/stream';
import { MarkDown } from '@/components/ui';
import { ThinkingBlock } from './ThinkingBlock';
import { PromptSuggestions } from './PromptSuggestions';
import { getToolComponent } from '@/components/chat/tools/registry';
import { buildSegments } from './segmentBuilder';

interface MessageRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  chatId?: string;
  isLastBotMessage?: boolean;
  onSuggestionSelect?: (suggestion: string) => void;
}

const MessageRendererInner: React.FC<MessageRendererProps> = ({
  content,
  className = '',
  isStreaming = false,
  chatId,
  isLastBotMessage = false,
  onSuggestionSelect,
}) => {
  const { segments, activeThinkingIndex } = React.useMemo(() => {
    const parsedEvents = parseEventLog(content);
    const builtSegments = buildSegments(parsedEvents);

    let thinkingIndex = -1;
    if (isStreaming && parsedEvents.length > 0) {
      const lastEvent = parsedEvents[parsedEvents.length - 1];
      if (lastEvent.type === 'assistant_thinking') {
        for (let i = parsedEvents.length - 1; i >= 0; i--) {
          if (parsedEvents[i].type === 'assistant_thinking') {
            thinkingIndex = i;
            break;
          }
        }
      }
    }

    return {
      segments: builtSegments,
      activeThinkingIndex: thinkingIndex,
    };
  }, [content, isStreaming]);

  return (
    <div className={className}>
      {segments.map((segment) => {
        switch (segment.kind) {
          case 'text':
            return (
              <div
                key={segment.id}
                className="prose prose-sm dark:prose-invert max-w-none break-words"
              >
                <MarkDown content={segment.text} />
              </div>
            );
          case 'thinking': {
            return (
              <div key={segment.id} className="mb-2 mt-0.5">
                <ThinkingBlock
                  content={segment.text}
                  isActiveThinking={segment.eventIndex === activeThinkingIndex}
                />
              </div>
            );
          }
          case 'tool': {
            const Component = getToolComponent(segment.tool.name);
            return (
              <div key={segment.id} className="mb-2 mt-1">
                <Component tool={segment.tool} chatId={chatId} />
              </div>
            );
          }
          case 'suggestions': {
            if (!isLastBotMessage || !onSuggestionSelect) {
              return null;
            }
            return (
              <PromptSuggestions
                key={segment.id}
                suggestions={segment.suggestions}
                onSelect={onSuggestionSelect}
              />
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
};

export const MessageRenderer = memo(MessageRendererInner);
