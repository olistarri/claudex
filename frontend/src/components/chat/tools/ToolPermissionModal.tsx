import { useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { Button, MarkDown } from '@/components/ui';
import type { PermissionRequest } from '@/types';

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value, null, 2);
}

interface ToolPermissionModalProps {
  request: PermissionRequest | null;
  onApprove: () => void;
  onReject: (alternativeInstruction?: string) => void;
  isLoading?: boolean;
}

export function ToolPermissionModal({
  request,
  onApprove,
  onReject,
  isLoading = false,
}: ToolPermissionModalProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [alternativeInstruction, setAlternativeInstruction] = useState('');

  if (!request || request.tool_name === 'AskUserQuestion') return null;

  const handleReject = () => {
    if (showRejectInput && alternativeInstruction.trim()) {
      onReject(alternativeInstruction.trim());
      setAlternativeInstruction('');
      setShowRejectInput(false);
    } else {
      setShowRejectInput(true);
    }
  };

  const handleJustReject = () => {
    onReject();
    setShowRejectInput(false);
    setAlternativeInstruction('');
  };

  const hasParams = request.tool_input && Object.keys(request.tool_input).length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 dark:border-border-dark">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500">
            <ShieldAlert className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              Permission Required
            </h2>
            <p className="text-2xs text-text-secondary dark:text-text-dark-secondary">
              Tool:{' '}
              <code className="rounded bg-surface-tertiary px-1 py-0.5 font-mono dark:bg-surface-dark-tertiary">
                {request.tool_name}
              </code>
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface-secondary/50 p-3 dark:border-border-dark dark:bg-surface-dark-secondary/50">
              {hasParams ? (
                <div className="space-y-2">
                  {Object.entries(request.tool_input).map(([key, value]) => (
                    <div key={key} className="space-y-0.5">
                      <div className="text-2xs font-medium uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                        {key}
                      </div>
                      <div className="overflow-auto rounded-md bg-surface-tertiary px-2 py-1.5 text-xs text-text-primary dark:bg-surface-dark-tertiary dark:text-text-dark-primary">
                        <MarkDown content={formatValue(value)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs italic text-text-tertiary dark:text-text-dark-tertiary">
                  No parameters
                </p>
              )}
            </div>

            {showRejectInput && (
              <div className="rounded-lg border border-border bg-surface-secondary/50 p-3 dark:border-border-dark dark:bg-surface-dark-secondary/50">
                <label className="text-2xs font-medium uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                  Alternative Instructions
                </label>
                <textarea
                  value={alternativeInstruction}
                  onChange={(e) => setAlternativeInstruction(e.target.value)}
                  placeholder="Tell the agent what to do instead..."
                  className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder-text-quaternary transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark-primary dark:placeholder-text-dark-tertiary"
                  rows={2}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3 dark:border-border-dark">
          {showRejectInput ? (
            <>
              <Button
                onClick={handleJustReject}
                variant="secondary"
                disabled={isLoading}
                className="flex-1"
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                Just Reject
              </Button>
              <Button
                onClick={handleReject}
                variant="primary"
                disabled={isLoading || !alternativeInstruction.trim()}
                className="flex-1"
              >
                Send
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleReject}
                variant="secondary"
                disabled={isLoading}
                className="flex-1"
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
              <Button onClick={onApprove} variant="primary" disabled={isLoading} className="flex-1">
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
