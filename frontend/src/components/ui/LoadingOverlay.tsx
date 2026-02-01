import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { modalBackdropClass } from './shared/modalConstants';

interface LoadingOverlayProps {
  isOpen: boolean;
  message: string;
}

export function LoadingOverlay({ isOpen, message }: LoadingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement;
    overlayRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        overlayRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && document.body.contains(previousActiveElement)) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      className={`${modalBackdropClass} z-[300] outline-none focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand-400`}
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" aria-hidden="true" />
        <p
          className="text-sm text-text-dark-quaternary"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message}
        </p>
      </div>
    </div>,
    document.body,
  );
}
