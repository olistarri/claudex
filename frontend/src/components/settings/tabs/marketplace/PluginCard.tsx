import type { MarketplacePlugin } from '@/types/marketplace.types';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/primitives/Badge';

interface PluginCardProps {
  plugin: MarketplacePlugin;
  isInstalled: boolean;
  onClick: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  development:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
  productivity:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
  testing:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
  database:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
  deployment:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
  security:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
  design:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
  other:
    'bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary',
};

export const PluginCard: React.FC<PluginCardProps> = ({ plugin, isInstalled, onClick }) => {
  const categoryColor = CATEGORY_COLORS[plugin.category] || CATEGORY_COLORS.other;

  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col rounded-xl border border-border p-4 text-left transition-all duration-200 hover:border-border-hover dark:border-border-dark dark:hover:border-border-dark-hover"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-xs font-medium text-text-primary dark:text-text-dark-primary">
              {plugin.name}
            </h3>
            {isInstalled && (
              <Badge variant="success" size="sm">
                Installed
              </Badge>
            )}
          </div>
          {plugin.author?.name && (
            <p className="mt-0.5 text-xs text-text-tertiary dark:text-text-dark-tertiary">
              by {plugin.author.name}
            </p>
          )}
        </div>
        {plugin.version && (
          <span className="flex-shrink-0 rounded-md border border-border px-1.5 py-0.5 text-2xs text-text-quaternary dark:border-border-dark dark:text-text-dark-quaternary">
            v{plugin.version}
          </span>
        )}
      </div>

      <p className="mb-3 line-clamp-2 flex-1 text-2xs text-text-tertiary dark:text-text-dark-tertiary">
        {plugin.description}
      </p>

      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${categoryColor}`}>
          {plugin.category}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-text-quaternary transition-colors duration-200 group-hover:text-text-secondary dark:text-text-dark-quaternary dark:group-hover:text-text-dark-secondary" />
      </div>
    </button>
  );
};
