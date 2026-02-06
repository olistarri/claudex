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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalMsRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const schedulePolling = useCallback(
    (pollFn: () => Promise<void>) => {
      stopPolling();
      pollingRef.current = setInterval(() => {
        void pollFn();
      }, pollIntervalMsRef.current);
    },
    [stopPolling],
  );

  const startDeviceFlow = async () => {
    setState('waiting');
    setErrorMsg(null);
    stopPolling();

    try {
      const resp = await apiClient.post<DeviceCodeResponse>('/copilot-auth/device-code');
      if (!resp) {
        throw new Error('Empty response');
      }

      setDeviceInfo({ uri: resp.verification_uri, code: resp.user_code });

      pollIntervalMsRef.current = (resp.interval + 3) * 1000;
      const expiresAt = Date.now() + resp.expires_in * 1000;

      const poll = async () => {
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
            schedulePolling(poll);
          }
        } catch {
          stopPolling();
          setState('error');
          setErrorMsg('Authorization failed. Please try again.');
        }
      };

      schedulePolling(poll);
    } catch {
      setState('error');
      setErrorMsg('Failed to start GitHub authorization.');
    }
  };

  if (value && state !== 'waiting') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
        <Check className="h-4 w-4 text-success-600 dark:text-success-400" />
        <span className="text-sm text-success-700 dark:text-success-400">
          GitHub Copilot connected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-xs"
          onClick={startDeviceFlow}
        >
          Re-authenticate
        </Button>
      </div>
    );
  }

  if (state === 'waiting' && deviceInfo) {
    return (
      <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            Waiting for authorization...
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-blue-600 dark:text-blue-300">
            1. Open this URL in your browser:
          </p>
          <a
            href={deviceInfo.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {deviceInfo.uri}
            <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-xs text-blue-600 dark:text-blue-300">2. Enter this code:</p>
          <code className="block rounded bg-white px-3 py-2 text-lg font-bold tracking-widest text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            {deviceInfo.code}
          </code>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
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
