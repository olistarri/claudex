import { memo, useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Copy, GitFork, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MessageContent } from './MessageContent';
import { UserAvatar, BotAvatar } from './MessageAvatars';
import { useModelsQuery, useForkChatMutation, useRestoreCheckpointMutation } from '@/hooks/queries';
import type { MessageAttachment } from '@/types';
import { ConfirmDialog, LoadingOverlay, Button, Spinner, Tooltip } from '@/components/ui';
import { formatRelativeTime, formatFullTimestamp } from '@/utils/date';
import toast from 'react-hot-toast';
import { useChatContext } from '@/hooks/useChatContext';
import { SandboxProvider } from '@/config/constants';

export interface MessageProps {
  id: string;
  content: string;
  isBot: boolean;
  attachments?: MessageAttachment[];
  copiedMessageId: string | null;
  onCopy: (content: string, id: string) => void;
  error?: string | null;
  isThisMessageStreaming: boolean;
  isGloballyStreaming: boolean;
  createdAt?: string;
  modelId?: string;
  isLastBotMessageWithCommit?: boolean;
  onRestoreSuccess?: () => void;
}

export const Message = memo(function Message({
  id,
  content,
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
}: MessageProps) {
  const { chatId, sandboxId, sandboxProvider } = useChatContext();
  const { data: models = [] } = useModelsQuery();
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
    return model?.name || modelId;
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
    <div className="group px-4 py-2 sm:px-6 sm:py-3">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="mt-1 flex-shrink-0">{isBot ? <BotAvatar /> : <UserAvatar />}</div>

        <div className="min-w-0 flex-1">
          {isBot ? (
            <div className="prose prose-sm max-w-none break-words text-text-primary dark:text-text-dark-primary">
              <MessageContent
                content={content}
                isBot={isBot}
                attachments={attachments}
                isStreaming={isThisMessageStreaming}
                chatId={chatId}
              />
            </div>
          ) : (
            <div className="inline-block max-w-full rounded-2xl border border-border bg-surface-secondary px-4 py-2.5 dark:border-border-dark dark:bg-surface-dark-secondary">
              <div className="prose prose-sm max-w-none break-words text-text-primary dark:text-text-dark-primary">
                <MessageContent
                  content={content}
                  isBot={isBot}
                  attachments={attachments}
                  isStreaming={isThisMessageStreaming}
                  chatId={chatId}
                />
              </div>
            </div>
          )}

          {isBot && content.trim() && !isThisMessageStreaming && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Tooltip content={copiedMessageId === id ? 'Copied!' : 'Copy'} position="bottom">
                  <Button
                    onClick={() => onCopy(content, id)}
                    variant="unstyled"
                    className={`relative overflow-hidden rounded-lg p-1.5 transition-all duration-200 ${
                      copiedMessageId === id
                        ? 'bg-success-100 text-success-600 dark:bg-success-500/10 dark:text-success-400'
                        : 'text-text-tertiary hover:bg-surface-secondary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-primary'
                    }`}
                  >
                    {copiedMessageId === id ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
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
                        className={`relative rounded-lg p-1.5 transition-all duration-200 ${
                          isRestoring || isGloballyStreaming
                            ? 'cursor-not-allowed opacity-50'
                            : 'text-text-tertiary hover:bg-surface-secondary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-primary'
                        }`}
                      >
                        {isRestoring ? <Spinner size="sm" /> : <RotateCcw className="h-4 w-4" />}
                      </Button>
                    </Tooltip>

                    {sandboxProvider === SandboxProvider.DOCKER && sandboxId && (
                      <Tooltip content={isForking ? 'Forking...' : 'Fork'} position="bottom">
                        <Button
                          onClick={handleFork}
                          disabled={isForking || isGloballyStreaming}
                          variant="unstyled"
                          className={`relative rounded-lg p-1.5 transition-all duration-200 ${
                            isForking || isGloballyStreaming
                              ? 'cursor-not-allowed opacity-50'
                              : 'text-text-tertiary hover:bg-surface-secondary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-primary'
                          }`}
                        >
                          {isForking ? <Spinner size="sm" /> : <GitFork className="h-4 w-4" />}
                        </Button>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-text-tertiary dark:text-text-dark-tertiary">
                {modelName && <span>{modelName}</span>}
                {modelName && relativeTime && <span>•</span>}
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
