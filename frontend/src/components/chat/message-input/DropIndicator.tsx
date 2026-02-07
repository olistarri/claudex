import { Image, FileText, FileSpreadsheet, Upload } from 'lucide-react';

export interface DropIndicatorProps {
  visible: boolean;
  fileType?: 'image' | 'pdf' | 'xlsx' | 'any';
  message?: string;
  className?: string;
}

interface IconWrapperProps {
  children: React.ReactNode;
}

const IconWrapper = ({ children }: IconWrapperProps) => (
  <div className="relative">
    <div className="absolute inset-0 animate-pulse rounded-full bg-text-quaternary/20 blur-xl dark:bg-text-dark-quaternary/20"></div>
    <div className="relative rounded-full bg-surface p-2.5 shadow-medium dark:bg-surface-dark">
      {children}
    </div>
  </div>
);

export function DropIndicator({
  visible,
  fileType = 'image',
  message = 'Drop image here',
  className = '',
}: DropIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-10 flex animate-fade-in items-center justify-center rounded-2xl bg-surface/80 backdrop-blur-sm transition-all duration-200 dark:bg-surface-dark/80 ${className}`}
    >
      <div className="flex flex-col items-center gap-2 p-3 text-text-primary dark:text-text-dark-primary">
        <IconWrapper>
          {fileType === 'image' ? (
            <Image className="h-5 w-5" />
          ) : fileType === 'pdf' ? (
            <FileText className="h-5 w-5" />
          ) : fileType === 'xlsx' ? (
            <FileSpreadsheet className="h-5 w-5" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
        </IconWrapper>
        <p className="text-sm font-semibold">{message}</p>
        <div className="max-w-xs text-center text-xs font-medium text-text-tertiary dark:text-text-dark-tertiary">
          {fileType === 'image'
            ? 'PNG • JPEG • GIF • WebP'
            : fileType === 'pdf'
              ? 'PDF documents'
              : fileType === 'xlsx'
                ? 'Excel documents'
                : 'Release to upload'}
        </div>
      </div>
    </div>
  );
}
