import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Check, Loader2, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface DeviceCodeResponse {
  verification_uri: string;
  user_code: string;
  device_code: string;
  interval: number;
  expires_in: number;
}

interface PollTokenResponse {
  status: string;
  access_token: string | null;
  interval?: number;
}

interface CopilotAuthButtonProps {
  value: string | null;
  onChange: (token: string | null) => void;
}

export const CopilotAuthButton: React.FC<CopilotAuthButtonProps> = ({ value, onChange }) => {
  const [state, setState] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
  const [deviceInfo, setDeviceInfo] = useState<{ uri: string; code: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalMsRef = useRef<number>(0);
  const flowIdRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      flowIdRef.current += 1;
      stopPolling();
    },
    [stopPolling],
  );

  const schedulePolling = useCallback(
    (pollFn: () => Promise<void>, flowId: number) => {
      stopPolling();
      pollingRef.current = setTimeout(() => {
        if (flowId !== flowIdRef.current) {
          return;
        }
        void pollFn();
      }, pollIntervalMsRef.current);
    },
    [stopPolling],
  );

  const startDeviceFlow = async () => {
    setState('waiting');
    setErrorMsg(null);
    flowIdRef.current += 1;
    const flowId = flowIdRef.current;
    stopPolling();

    try {
      const resp = await apiClient.post<DeviceCodeResponse>('/copilot-auth/device-code');
      if (!resp) {
        throw new Error('Empty response');
      }
      if (flowId !== flowIdRef.current) {
        return;
      }

      setDeviceInfo({ uri: resp.verification_uri, code: resp.user_code });

      pollIntervalMsRef.current = (resp.interval + 3) * 1000;
      const expiresAt = Date.now() + resp.expires_in * 1000;

      const poll = async () => {
        if (flowId !== flowIdRef.current) {
          return;
        }
        if (Date.now() > expiresAt) {
          stopPolling();
          setState('error');
          setErrorMsg('Authorization timed out. Please try again.');
          return;
        }

        try {
          const pollResp = await apiClient.post<PollTokenResponse>('/copilot-auth/poll-token', {
            device_code: resp.device_code,
          });

          if (pollResp?.status === 'success' && pollResp.access_token) {
            stopPolling();
            onChange(pollResp.access_token);
            setState('success');
            return;
          }

          if (pollResp?.status === 'slow_down') {
            const nextInterval =
              typeof pollResp.interval === 'number' && pollResp.interval > 0
                ? pollResp.interval + 3
                : Math.floor(pollIntervalMsRef.current / 1000) + 5;
            pollIntervalMsRef.current = nextInterval * 1000;
          }
        } catch {
          if (flowId !== flowIdRef.current) {
            return;
          }
          stopPolling();
          setState('error');
          setErrorMsg('Authorization failed. Please try again.');
          return;
        }

        if (flowId === flowIdRef.current) {
          schedulePolling(poll, flowId);
        }
      };

      schedulePolling(poll, flowId);
    } catch {
      if (flowId !== flowIdRef.current) {
        return;
      }
      setState('error');
      setErrorMsg('Failed to start GitHub authorization.');
    }
  };

  if (value && state !== 'waiting') {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-tertiary p-3 dark:border-border-dark dark:bg-surface-dark-tertiary">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-success-600 dark:text-success-400" />
          <span className="text-sm text-text-primary dark:text-text-dark-primary">
            GitHub Copilot connected
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={startDeviceFlow}>
          Re-authenticate
        </Button>
      </div>
    );
  }

  if (state === 'waiting' && deviceInfo) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-surface-tertiary p-4 dark:border-border-dark dark:bg-surface-dark-tertiary">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-400" />
          <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
            Waiting for authorization...
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
            1. Open this URL in your browser:
          </p>
          <a
            href={deviceInfo.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {deviceInfo.uri}
            <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
            2. Enter this code:
          </p>
          <code className="bg-surface-primary dark:bg-surface-dark-primary block rounded px-3 py-2 text-lg font-bold tracking-widest text-text-primary dark:text-text-dark-primary">
            {deviceInfo.code}
          </code>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            flowIdRef.current += 1;
            stopPolling();
            setState('idle');
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={startDeviceFlow}>
        Login with GitHub Copilot
      </Button>
      {state === 'error' && errorMsg && (
        <p className="text-xs text-error-600 dark:text-error-400">{errorMsg}</p>
      )}
      <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
        Requires a GitHub Copilot subscription. Authenticates via GitHub&apos;s device flow.
      </p>
    </div>
  );
};
