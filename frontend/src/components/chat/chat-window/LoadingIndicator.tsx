import { memo } from 'react';
import { motion } from 'framer-motion';
import iconDark from '/assets/images/icon-dark.svg';
import iconLight from '/assets/images/icon-white.svg';

export const LoadingIndicator = memo(function LoadingIndicator() {
  return (
    <motion.div
      className="flex items-center justify-center pb-2 pt-4"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="relative flex items-center gap-2 overflow-hidden rounded-full border border-border/50 bg-surface-tertiary/80 px-3 py-1.5 dark:border-border-dark/50 dark:bg-surface-dark-tertiary/80">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img src={iconDark} alt="" className="h-3.5 w-3.5 dark:hidden" />
          <img src={iconLight} alt="" className="hidden h-3.5 w-3.5 dark:block" />
        </motion.div>

        <span className="text-xs font-medium text-text-tertiary dark:text-text-dark-tertiary">
          Thinking
        </span>

        <div className="flex items-center gap-[3px]">
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.div
              key={i}
              className="h-1 w-1 rounded-full bg-text-quaternary dark:bg-text-dark-quaternary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay,
              }}
            />
          ))}
        </div>

        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent dark:via-white/[0.04]"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
        />
      </div>
    </motion.div>
  );
});
