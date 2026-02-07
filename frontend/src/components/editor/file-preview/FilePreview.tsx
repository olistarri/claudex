import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import type { ComponentType } from 'react';
import { createPortal } from 'react-dom';
import type { FileStructure } from '@/types';
import {
  isCsvFile,
  isMarkdownFile,
  isXlsxFile,
  isImageFile,
  isHtmlFile,
  isPowerPointFile,
  isPdfFile,
} from '@/utils/fileTypes';
import { MarkdownPreview } from './MarkdownPreview';
import { CsvPreview } from './CsvPreview';
import { XlsxPreview } from './XlsxPreview';
import { ImagePreview } from './ImagePreview';
import { HtmlPreview } from './HtmlPreview';
import { PowerPointPreview } from './PowerPointPreview';
import { PDFPreview } from './PDFPreview';

type PreviewComponentProps = {
  file: FileStructure;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

type PreviewComponent = ComponentType<PreviewComponentProps>;

interface PreviewRenderer {
  match: (file: FileStructure) => boolean;
  Component: PreviewComponent;
}

const previewRenderers: PreviewRenderer[] = [
  { match: isMarkdownFile, Component: MarkdownPreview },
  { match: isCsvFile, Component: CsvPreview },
  { match: isXlsxFile, Component: XlsxPreview },
  { match: isImageFile, Component: ImagePreview },
  { match: isHtmlFile, Component: HtmlPreview },
  { match: isPowerPointFile, Component: PowerPointPreview },
  { match: isPdfFile, Component: PDFPreview },
];

export interface FilePreviewProps {
  file: FileStructure;
  showPreview: boolean;
}

export const FilePreview = memo(function FilePreview({ file, showPreview }: FilePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const matchedPreview = useMemo(() => previewRenderers.find(({ match }) => match(file)), [file]);

  const PreviewComponent = matchedPreview?.Component;

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    },
    [isFullscreen],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  useEffect(() => {
    if (!showPreview) {
      setIsFullscreen(false);
    }
  }, [showPreview]);

  useEffect(() => {
    setIsFullscreen(false);
  }, [file.path]);

  if (!showPreview || !PreviewComponent) {
    return null;
  }

  const previewContent = (
    <PreviewComponent
      file={file}
      isFullscreen={isFullscreen}
      onToggleFullscreen={handleToggleFullscreen}
    />
  );

  if (isFullscreen) {
    if (typeof document === 'undefined') {
      return previewContent;
    }

    return createPortal(
      <div className="bg-surface-primary dark:bg-surface-dark-primary fixed inset-0 z-50">
        {previewContent}
      </div>,
      document.body,
    );
  }

  return previewContent;
});
