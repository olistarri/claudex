export const Z_INDEX = {
  modal: 50,
  modalHigh: 100,
  modalHighest: 200,
} as const;

export const modalBackdropClass = 'fixed inset-0 bg-black/50 flex items-center justify-center p-4';
export const modalContainerClass =
  'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl w-full overflow-hidden shadow-strong';

export const closeButtonClass =
  'p-1 text-text-quaternary hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary rounded-lg transition-colors duration-200';
export const cancelButtonClass =
  'px-4 py-2 text-text-tertiary dark:text-text-dark-tertiary hover:bg-surface-hover dark:hover:bg-surface-dark-hover rounded-lg transition-colors duration-200';

export const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-full',
} as const;
