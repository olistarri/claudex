import { getFileName } from '@/utils/file';
import { cn } from '@/utils/cn';
import { HighlightMatch } from './HighlightMatch';

export interface FileNameProps {
  path: string;
  isFolder: boolean;
  className?: string;
  searchQuery?: string;
}

export function FileName({ path, isFolder, className, searchQuery = '' }: FileNameProps) {
  const fileName = getFileName(path);
  const hasSearch = searchQuery.trim().length > 0;

  if (isFolder) {
    return (
      <span
        className={cn(
          'text-xs font-medium text-text-primary dark:text-text-dark-primary',
          !hasSearch && 'truncate',
          className,
        )}
        title={path}
      >
        {hasSearch ? <HighlightMatch text={fileName} searchQuery={searchQuery} /> : fileName}
      </span>
    );
  }

  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const baseName = parts.join('.');

  if (hasSearch) {
    return (
      <span className={cn('text-xs', className)} title={path}>
        <HighlightMatch text={fileName} searchQuery={searchQuery} />
      </span>
    );
  }

  return (
    <span className={cn('flex items-center text-xs', className)} title={path}>
      <span className="min-w-0 truncate">{baseName || fileName}</span>
      {ext && (
        <span className="flex-shrink-0 text-text-quaternary dark:text-text-dark-quaternary">
          .{ext}
        </span>
      )}
    </span>
  );
}
