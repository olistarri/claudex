import { memo, useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Copy, GitFork, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MessageContent } from './MessageContent';
import {
  useModelsQuery,
  useForkChatMutation,
  useRestoreCheckpointMutation,
  useSettingsQuery,
} from '@/hooks/queries';
import type { AssistantStreamEvent, MessageAttachment } from '@/types';
import { ConfirmDialog, LoadingOverlay, Button, Spinner, Tooltip } from '@/components/ui';
import { formatRelativeTime, formatFullTimestamp } from '@/utils/date';
import toast from 'react-hot-toast';
import { useChatContext } from '@/hooks/useChatContext';

export interface MessageProps {
  id: string;
  contentText: string;
  contentRender?: {
    events?: AssistantStreamEvent[];
    segments?: unknown[];
  };
  isBot: boolean;
  attachments?: MessageAttachment[];
  uploadingAttachmentIds?: string[];
  copiedMessageId: string | null;
  onCopy: (content: string, id: string) => void;
  error?: string | null;
  isThisMessageStreaming: boolean;
  isGloballyStreaming: boolean;
  createdAt?: string;
  modelId?: string;
  isLastBotMessageWithCommit?: boolean;
  onRestoreSuccess?: () => void;
  isLastBotMessage?: boolean;
  onSuggestionSelect?: (suggestion: string) => void;
}

export const Message = memo(function Message({
  id,
  contentText,
  contentRender,
  isBot,
  attachments,
  copiedMessageId,
  onCopy,
  isThisMessageStreaming,
  isGloballyStreaming,
  createdAt,
  modelId,
  isLastBotMessageWithCommit,
  onRestoreSuccess,
  isLastBotMessage,
  onSuggestionSelect,
  uploadingAttachmentIds,
}: MessageProps) {
  const { chatId, sandboxId } = useChatContext();
  const { data: models = [] } = useModelsQuery();
  const { data: settings } = useSettingsQuery();
  const sandboxProvider = settings?.sandbox_provider ?? 'docker';
  const navigate = useNavigate();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const relativeTime = useMemo(() => (createdAt ? formatRelativeTime(createdAt) : ''), [createdAt]);
  const fullTimestamp = useMemo(
    () => (createdAt ? formatFullTimestamp(createdAt) : ''),
    [createdAt],
  );
  const modelName = useMemo(() => {
    if (!modelId) return null;
    const model = models.find((m) => m.model_id === modelId);
    if (model?.name) return model.name;
    return modelId.includes(':') ? modelId.split(':').pop()! : modelId;
  }, [modelId, models]);

  const restoreMutation = useRestoreCheckpointMutation({
    onSuccess: () => {
      setIsRestoring(false);
      setShowConfirmDialog(false);
      toast.success('Checkpoint restored successfully');
      onRestoreSuccess?.();
    },
    onError: () => {
      toast.error('Failed to restore checkpoint. Please try again.');
      setIsRestoring(false);
      setShowConfirmDialog(false);
    },
  });

  const forkMutation = useForkChatMutation({
    onSuccess: (data) => {
      setIsForking(false);
      toast.success(`Chat forked with ${data.messages_copied} messages`);
      navigate(`/chat/${data.chat.id}`);
    },
    onError: () => {
      toast.error('Failed to fork chat. Please try again.');
      setIsForking(false);
    },
  });

  const handleRestore = useCallback(() => {
    if (!chatId || isRestoring) return;
    setShowConfirmDialog(true);
  }, [chatId, isRestoring]);

  const handleConfirmRestore = useCallback(() => {
    if (!chatId || !id) return;
    setIsRestoring(true);
    restoreMutation.mutate({ chatId, messageId: id, sandboxId });
  }, [chatId, id, sandboxId, restoreMutation]);

  const handleFork = useCallback(() => {
    if (!chatId || isForking) return;
    setIsForking(true);
    forkMutation.mutate({ chatId, messageId: id });
  }, [chatId, id, isForking, forkMutation]);

  return (
    <div className="group px-4 py-1.5 sm:px-6 sm:py-2">
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          {isBot ? (
            <div className="max-w-none break-words text-sm text-text-primary dark:text-text-dark-primary">
              <MessageContent
                contentText={contentText}
                contentRender={contentRender}
                isBot={isBot}
                attachments={attachments}
                isStreaming={isThisMessageStreaming}
                chatId={chatId}
                isLastBotMessage={isLastBotMessage}
                onSuggestionSelect={onSuggestionSelect}
              />
            </div>
          ) : (
            <div className="inline-block max-w-full rounded-xl bg-surface-hover/60 px-3 py-1.5 dark:bg-surface-dark-tertiary/80">
              <div className="max-w-none break-words text-sm text-text-primary dark:text-text-dark-primary">
                <MessageContent
                  contentText={contentText}
                  contentRender={contentRender}
                  isBot={isBot}
                  attachments={attachments}
                  uploadingAttachmentIds={uploadingAttachmentIds}
                  isStreaming={isThisMessageStreaming}
                  chatId={chatId}
                />
              </div>
            </div>
          )}

          {isBot && contentText.trim() && !isThisMessageStreaming && (
            <div className="mt-2 flex items-center justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="flex items-center gap-0.5">
                <Tooltip content={copiedMessageId === id ? 'Copied!' : 'Copy'} position="bottom">
                  <Button
                    onClick={() => onCopy(contentText, id)}
                    variant="unstyled"
                    className={`relative overflow-hidden rounded-md p-1 transition-all duration-200 ${
                      copiedMessageId === id
                        ? 'bg-success-100 text-success-600 dark:bg-success-500/10 dark:text-success-400'
                        : 'text-text-quaternary hover:bg-surface-hover hover:text-text-primary dark:text-text-dark-quaternary dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-primary'
                    }`}
                  >
                    {copiedMessageId === id ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </Tooltip>

                {!isLastBotMessageWithCommit && (
                  <>
                    <Tooltip content={isRestoring ? 'Restoring...' : 'Restore'} position="bottom">
                      <Button
                        onClick={handleRestore}
                        disabled={isRestoring || isGloballyStreaming}
                        variant="unstyled"
                        className={`relative rounded-md p-1 transition-all duration-200 ${
                          isRestoring || isGloballyStreaming
                            ? 'cursor-not-allowed opacity-50'
                            : 'text-text-quaternary hover:bg-surface-hover hover:text-text-primary dark:text-text-dark-quaternary dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-primary'
                        }`}
                      >
                        {isRestoring ? (
                          <Spinner size="sm" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </Tooltip>

                    {sandboxProvider === 'docker' && sandboxId && (
                      <Tooltip content={isForking ? 'Forking...' : 'Fork'} position="bottom">
                        <Button
                          onClick={handleFork}
                          disabled={isForking || isGloballyStreaming}
                          variant="unstyled"
                          className={`relative rounded-md p-1 transition-all duration-200 ${
                            isForking || isGloballyStreaming
                              ? 'cursor-not-allowed opacity-50'
                              : 'text-text-quaternary hover:bg-surface-hover hover:text-text-primary dark:text-text-dark-quaternary dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-primary'
                          }`}
                        >
                          {isForking ? <Spinner size="sm" /> : <GitFork className="h-3.5 w-3.5" />}
                        </Button>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                {modelName && <span>{modelName}</span>}
                {modelName && relativeTime && <span>·</span>}
                {relativeTime && (
                  <Tooltip content={fullTimestamp} position="bottom">
                    <span className="cursor-default">{relativeTime}</span>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmRestore}
        title="Restore to This Message"
        message="Restore conversation to this message? Newer messages will be deleted."
        confirmLabel="Restore"
        cancelLabel="Cancel"
      />

      <LoadingOverlay isOpen={isRestoring} message="Restoring checkpoint..." />
      <LoadingOverlay isOpen={isForking} message="Forking chat..." />
    </div>
  );
});
