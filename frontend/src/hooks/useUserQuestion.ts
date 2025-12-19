import { useState, useCallback } from 'react';
import { permissionService } from '@/services/permissionService';
import { usePermissionStore } from '@/store';

export function useUserQuestion(chatId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequests = usePermissionStore((state) => state.pendingRequests);
  const clearPermissionRequest = usePermissionStore((state) => state.clearPermissionRequest);

  const pendingRequest = chatId ? (pendingRequests.get(chatId) ?? null) : null;
  const isAskUserQuestion = pendingRequest?.tool_name === 'AskUserQuestion';

  const handleSubmitAnswers = useCallback(
    async (answers: Record<string, string | string[]>) => {
      if (!chatId || !pendingRequest) return;

      setIsLoading(true);
      setError(null);
      try {
        await permissionService.respondWithAnswers(chatId, pendingRequest.request_id, answers);
        clearPermissionRequest(chatId);
      } catch (err) {
        if ((err as Error & { status?: number })?.status === 404) {
          clearPermissionRequest(chatId);
        } else {
          setError('Failed to submit answers. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, pendingRequest, clearPermissionRequest],
  );

  const handleCancel = useCallback(async () => {
    if (!chatId || !pendingRequest) return;

    setIsLoading(true);
    setError(null);
    try {
      await permissionService.respondToPermission(chatId, pendingRequest.request_id, false);
      clearPermissionRequest(chatId);
    } catch (err) {
      if ((err as Error & { status?: number })?.status === 404) {
        clearPermissionRequest(chatId);
      } else {
        setError('Failed to cancel. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [chatId, pendingRequest, clearPermissionRequest]);

  return {
    pendingRequest: isAskUserQuestion ? pendingRequest : null,
    isLoading,
    error,
    handleSubmitAnswers,
    handleCancel,
  };
}
