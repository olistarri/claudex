import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cn } from '@/utils/cn';

type SwitchSize = 'sm' | 'md';

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role'
> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: SwitchSize;
  name?: string;
}

const trackBase =
  'relative inline-flex shrink-0 cursor-pointer rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60';

const sizeClasses: Record<SwitchSize, string> = {
  md: 'h-6 w-11 px-0.5',
  sm: 'h-5 w-9 px-0.5',
};

const knobSize: Record<SwitchSize, string> = {
  md: 'h-4 w-4',
  sm: 'h-3.5 w-3.5',
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, size = 'md', className, disabled, onClick, name, ...props },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    onCheckedChange?.(!checked);
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        trackBase,
        sizeClasses[size],
        checked
          ? 'border-transparent bg-brand-500'
          : 'border-border bg-surface-tertiary dark:border-border-dark dark:bg-surface-dark-tertiary',
        className,
      )}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {name ? <input type="hidden" name={name} value={String(checked)} /> : null}
      <span className="sr-only">Toggle</span>
      <span
        className={cn(
          'flex h-full w-full items-center rounded-full transition-all duration-200',
          checked ? 'justify-end' : 'justify-start',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full bg-surface-secondary shadow-sm transition-all duration-200 dark:bg-text-dark-primary',
            knobSize[size],
            checked ? 'scale-100' : 'scale-75',
          )}
        />
      </span>
    </button>
  );
});

Switch.displayName = 'Switch';
