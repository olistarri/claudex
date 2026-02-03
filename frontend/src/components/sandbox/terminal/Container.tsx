import { useState, useCallback, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { TerminalTab } from './TerminalTab';

export interface ContainerProps {
  sandboxId?: string;
  chatId?: string;
  isVisible: boolean;
  panelKey: 'single' | 'primary' | 'secondary';
}

interface TerminalInstance {
  id: string;
  label: string;
}

export const Container: FC<ContainerProps> = ({ sandboxId, chatId, isVisible, panelKey }) => {
  const defaultTerminalId = `terminal-${panelKey}-1`;
  const storageKey = chatId ? `terminal:${chatId}:${panelKey}` : null;
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: defaultTerminalId, label: 'Terminal 1' },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>(defaultTerminalId);
  const [closingTerminalIds, setClosingTerminalIds] = useState<Set<string>>(new Set());
  const readyToSave = useRef(false);

  useEffect(() => {
    readyToSave.current = false;

    if (!storageKey) {
      setTerminals([{ id: defaultTerminalId, label: 'Terminal 1' }]);
      setActiveTerminalId(defaultTerminalId);
      Promise.resolve().then(() => {
        readyToSave.current = true;
      });
      return;
    }

    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      setTerminals([{ id: defaultTerminalId, label: 'Terminal 1' }]);
      setActiveTerminalId(defaultTerminalId);
      Promise.resolve().then(() => {
        readyToSave.current = true;
      });
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        terminals?: TerminalInstance[];
        activeTerminalId?: string;
      };
      const parsedTerminals =
        parsed.terminals?.filter((terminal) => terminal.id && terminal.label) ?? [];
      const nextTerminals =
        parsedTerminals.length > 0
          ? parsedTerminals
          : [{ id: defaultTerminalId, label: 'Terminal 1' }];
      const nextActiveId =
        parsed.activeTerminalId &&
        nextTerminals.some((terminal) => terminal.id === parsed.activeTerminalId)
          ? parsed.activeTerminalId
          : (nextTerminals[0]?.id ?? defaultTerminalId);
      setTerminals(nextTerminals);
      setActiveTerminalId(nextActiveId);
    } catch {
      setTerminals([{ id: defaultTerminalId, label: 'Terminal 1' }]);
      setActiveTerminalId(defaultTerminalId);
    }
    Promise.resolve().then(() => {
      readyToSave.current = true;
    });
  }, [chatId, storageKey, defaultTerminalId]);

  useEffect(() => {
    if (!storageKey || !readyToSave.current) {
      return;
    }
    const payload = JSON.stringify({ terminals, activeTerminalId });
    localStorage.setItem(storageKey, payload);
  }, [storageKey, terminals, activeTerminalId]);

  const addTerminal = useCallback(() => {
    setTerminals((prev) => {
      const existingNumbers = new Set(prev.map((t) => parseInt(t.id.split('-').pop() || '0', 10)));

      let nextNumber = 1;
      while (existingNumbers.has(nextNumber)) {
        nextNumber += 1;
      }

      const newTerminal: TerminalInstance = {
        id: `terminal-${panelKey}-${nextNumber}`,
        label: `Terminal ${nextNumber}`,
      };

      setActiveTerminalId(newTerminal.id);
      return [...prev, newTerminal];
    });
  }, [panelKey]);

  const closeTerminal = useCallback((terminalId: string) => {
    setClosingTerminalIds((prev) => {
      const next = new Set(prev);
      next.add(terminalId);
      return next;
    });
  }, []);

  const finalizeCloseTerminal = useCallback(
    (terminalId: string) => {
      setTerminals((prev) => {
        const filtered = prev.filter((t) => t.id !== terminalId);
        if (filtered.length === 0) {
          setActiveTerminalId(defaultTerminalId);
          return [{ id: defaultTerminalId, label: 'Terminal 1' }];
        }

        setActiveTerminalId((current) => {
          if (current === terminalId) {
            const currentIndex = prev.findIndex((t) => t.id === terminalId);
            const nextTerminal = prev[currentIndex - 1] || prev[currentIndex + 1];
            return nextTerminal?.id || filtered[0]?.id || defaultTerminalId;
          }
          return current;
        });

        return filtered;
      });
      setClosingTerminalIds((prev) => {
        const next = new Set(prev);
        next.delete(terminalId);
        return next;
      });
    },
    [defaultTerminalId],
  );

  return (
    <div className="flex h-full flex-col bg-surface-secondary dark:bg-surface-dark-secondary">
      {/* Tab bar */}
      <div className="flex items-center overflow-x-auto border-b border-border bg-surface-secondary dark:border-border-dark dark:bg-surface-dark-secondary">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={`flex cursor-pointer items-center gap-2 border-r border-border px-3 py-2 text-xs dark:border-border-dark ${
              activeTerminalId === terminal.id
                ? 'bg-surface-secondary text-text-primary dark:bg-surface-dark-secondary dark:text-text-dark-primary'
                : 'text-text-secondary hover:bg-surface-hover dark:text-text-dark-secondary dark:hover:bg-surface-dark-hover'
            }`}
            onClick={() => setActiveTerminalId(terminal.id)}
          >
            <span>{terminal.label}</span>
            {terminals.length > 1 && (
              <button
                className="hover:text-text-primary dark:hover:text-text-dark-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminal.id);
                }}
                aria-label={`Close ${terminal.label}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          className="flex items-center justify-center px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary dark:text-text-dark-secondary dark:hover:bg-surface-dark-hover dark:hover:text-text-dark-primary"
          onClick={addTerminal}
          aria-label="Add new terminal"
        >
          +
        </button>
      </div>

      {/* Terminal instances */}
      <div className="relative flex-1 overflow-hidden">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={`absolute inset-0 ${activeTerminalId === terminal.id ? 'block' : 'hidden'}`}
          >
            <TerminalTab
              isVisible={isVisible && activeTerminalId === terminal.id}
              sandboxId={sandboxId}
              terminalId={terminal.id}
              shouldClose={closingTerminalIds.has(terminal.id)}
              onClosed={() => finalizeCloseTerminal(terminal.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
