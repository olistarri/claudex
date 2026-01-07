import { memo } from 'react';
import { User } from 'lucide-react';
import { useAuthStore } from '@/store';
import { useCurrentUserQuery } from '@/hooks/queries';
import { cn } from '@/utils/cn';
import iconDark from '/assets/images/icon-dark.svg';
import iconLight from '/assets/images/icon-white.svg';

export const UserAvatarCircle = memo(
  ({ displayName, size = 'default' }: { displayName: string; size?: 'default' | 'large' }) => {
    const sizeClasses = size === 'large' ? 'w-8 h-8' : 'w-6 h-6';
    const iconSize = size === 'large' ? 'w-4 h-4' : 'w-3 h-3';

    return (
      <div
        className={cn(
          sizeClasses,
          'rounded-full bg-gradient-to-br from-brand-500 to-brand-600',
          'flex items-center justify-center text-xs font-semibold text-white',
          'shadow-sm transition-all duration-200 group-hover:shadow-md',
        )}
      >
        {displayName?.[0]?.toUpperCase() || <User className={iconSize} />}
      </div>
    );
  },
);

UserAvatarCircle.displayName = 'UserAvatarCircle';

export const UserAvatar = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: user } = useCurrentUserQuery({
    enabled: isAuthenticated,
  });

  const displayName = user?.username || user?.email || 'User';

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
      <span className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
        {displayName?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
      </span>
    </div>
  );
};

export const BotAvatar = () => (
  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
    <img src={iconDark} alt="Claudex" className="h-4 w-4 dark:hidden" />
    <img src={iconLight} alt="Claudex" className="hidden h-4 w-4 dark:block" />
  </div>
);
