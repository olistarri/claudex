import { FolderOpen } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12">
      <FolderOpen className="h-5 w-5 text-text-quaternary dark:text-text-dark-quaternary" />
      <p className="text-xs text-text-quaternary dark:text-text-dark-quaternary">No files yet</p>
    </div>
  );
}
