import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import { useXterm } from '@/hooks/useXterm';
import { useUIStore } from '@/store';
import { authService } from '@/services/authService';
import { WS_BASE_URL } from '@/lib/api';
import { getTerminalBackgroundClass } from '@/utils/terminal';
import type { TerminalSize } from '@/types';

import 'xterm/css/xterm.css';

interface ProjectTerminalModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

type SessionState = 'idle' | 'connecting' | 'ready' | 'error';

const encoder = new TextEncoder();

export function ProjectTerminalModal({
  isOpen,
  projectId,
  projectName,
  onClose,
}: ProjectTerminalModalProps) {
  const theme = useUIStore((state) => state.theme);
  const [sessionState, setSessionState] = useState<SessionState>('idle');

  const lastSentSizeRef = useRef<TerminalSize | null>(null);
  const hasSentInitRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  const backgroundClass = useMemo(() => getTerminalBackgroundClass(theme), [theme]);

  const handleFit = useCallback((size: TerminalSize) => {
    if (!hasSentInitRef.current) return;
    const ws = wsRef.current;
    const lastSent = lastSentSizeRef.current;
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      (lastSent && lastSent.rows === size.rows && lastSent.cols === size.cols)
    )
      return;
    ws.send(JSON.stringify({ type: 'resize', rows: size.rows, cols: size.cols }));
    lastSentSizeRef.current = size;
  }, []);

  const { fitTerminal, isReady, terminalRef, wrapperRef } = useXterm({
    isVisible: isOpen,
    mode: theme,
    onData: (data: string) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    },
    onFit: handleFit,
  });

  useEffect(() => {
    if (!isOpen || !isReady || !projectId) return;

    const token = authService.getToken();
    if (!token) return;

    const wsUrl = `${WS_BASE_URL}/project/${projectId}/terminal?terminalId=project-terminal-1`;

    setSessionState('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    hasSentInitRef.current = false;
    lastSentSizeRef.current = null;

    const handleOpen = () => {
      setSessionState('connecting');
      ws.send(JSON.stringify({ type: 'auth', token }));

      const size =
        fitTerminal() ??
        (terminalRef.current
          ? { rows: terminalRef.current.rows, cols: terminalRef.current.cols }
          : { rows: 24, cols: 80 });

      ws.send(JSON.stringify({ type: 'init', rows: size.rows, cols: size.cols }));
      hasSentInitRef.current = true;
      lastSentSizeRef.current = size;

      requestAnimationFrame(() => terminalRef.current?.focus());
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data) as Record<string, unknown>;
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        if (message.type === 'stdout' && typeof message.data === 'string') {
          terminalRef.current?.write(message.data);
          setSessionState((prev) => (prev === 'connecting' ? 'ready' : prev));
          return;
        }
        if (message.type === 'init') {
          const rows = typeof message.rows === 'number' ? message.rows : undefined;
          const cols = typeof message.cols === 'number' ? message.cols : undefined;
          if (rows && cols) {
            lastSentSizeRef.current = { rows, cols };
          }
          setSessionState('ready');
          return;
        }
        if (message.type === 'error') {
          setSessionState('error');
        }
      } catch {
        // ignore parse errors
      }
    };

    const handleError = () => setSessionState('error');

    const handleClose = () => {
      wsRef.current = null;
      hasSentInitRef.current = false;
      lastSentSizeRef.current = null;
      setSessionState((prev) => (prev === 'error' ? prev : 'idle'));
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('error', handleError);
    ws.addEventListener('close', handleClose);

    return () => {
      ws.removeEventListener('open', handleOpen);
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      ws.removeEventListener('close', handleClose);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'detach' }));
      }
      ws.close();
      wsRef.current = null;
      hasSentInitRef.current = false;
      lastSentSizeRef.current = null;
      setSessionState('idle');
    };
  }, [isOpen, isReady, projectId, fitTerminal, terminalRef]);

  const overlayMessage = useMemo(() => {
    if (!isReady) return 'Initializing terminal...';
    if (sessionState === 'connecting') return 'Connecting...';
    if (sessionState === 'error') return 'Terminal connection interrupted';
    return null;
  }, [isReady, sessionState]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
      <div className="flex h-9 items-center justify-between border-b border-border-dark/50 bg-surface-dark px-3">
        <span className="font-mono text-2xs text-text-dark-secondary">{projectName}</span>
        <Button
          type="button"
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-text-dark-quaternary hover:text-text-dark-primary"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className={`relative flex-1 ${backgroundClass}`}>
        <div className="h-full overflow-hidden p-2">
          <div ref={wrapperRef} className="h-full w-full" />
        </div>
        {overlayMessage && (
          <div className={`absolute inset-0 flex items-center justify-center ${backgroundClass}`}>
            <div className="text-xs text-text-dark-tertiary">{overlayMessage}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
