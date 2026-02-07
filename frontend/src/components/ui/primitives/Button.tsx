import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'link'
  | 'gradient'
  | 'unstyled';

type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  loadingIcon?: ReactNode;
}

const variantClasses: Record<Exclude<ButtonVariant, 'unstyled'>, string> = {
  primary:
    'bg-text-primary text-surface shadow-sm hover:bg-text-secondary dark:bg-text-dark-primary dark:text-surface-dark dark:hover:bg-text-dark-secondary focus-visible:ring-text-quaternary/40',
  secondary:
    'bg-surface-secondary text-text-primary hover:bg-surface-hover dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:hover:bg-surface-dark-hover focus-visible:ring-text-quaternary/30',
  outline:
    'border border-border text-text-primary hover:bg-surface-hover dark:border-border-dark dark:text-text-dark-primary dark:hover:bg-surface-dark-hover focus-visible:ring-text-quaternary/30',
  ghost:
    'text-text-secondary hover:bg-surface-hover dark:text-text-dark-secondary dark:hover:bg-surface-dark-hover focus-visible:ring-text-quaternary/20',
  destructive: 'bg-error-500 text-white hover:bg-error-600 focus-visible:ring-error-500/60',
  link: 'text-text-secondary underline underline-offset-4 hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none',
  gradient:
    'relative overflow-hidden bg-gradient-to-r from-text-primary to-text-secondary text-surface shadow-lg hover:from-text-secondary hover:to-text-tertiary dark:from-text-dark-primary dark:to-text-dark-secondary dark:text-surface-dark focus-visible:ring-text-quaternary/40',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-3 text-xs',
  md: 'h-10 rounded-lg px-4 text-sm',
  lg: 'h-12 rounded-xl px-6 text-base',
  icon: 'h-9 w-9 rounded-md p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    loadingIcon,
    className,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const spinnerSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
  const spinner = loadingIcon ?? <Spinner size={spinnerSize} />;

  const content = (
    <>
      {isLoading && spinner}
      {isLoading && loadingText ? loadingText : children}
    </>
  );

  if (variant === 'unstyled') {
    return (
      <button ref={ref} className={className} disabled={disabled || isLoading} {...props}>
        {content}
      </button>
    );
  }

  const resolvedVariant = variant as Exclude<ButtonVariant, 'unstyled'>;

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-black',
        size !== 'icon' && 'gap-1.5',
        variantClasses[resolvedVariant],
        sizeClasses[size],
        variant === 'gradient' && 'group',
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {content}
    </button>
  );
});

Button.displayName = 'Button';
