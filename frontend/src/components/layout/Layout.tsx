import { ReactNode, useCallback, useMemo, useState } from 'react';
import { Header, type HeaderProps } from './Header';
import { cn } from '@/utils/cn';
import { LayoutContext, type LayoutContextValue } from './layoutState';

export interface LayoutProps extends HeaderProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  showHeader?: boolean;
}

export function Layout({
  children,
  onLogout,
  userName = 'User',
  isAuthPage = false,
  className,
  contentClassName,
  showHeader = true,
}: LayoutProps) {
  const [sidebarContent, setSidebarContent] = useState<ReactNode | null>(null);

  const setSidebar = useCallback((content: ReactNode | null) => {
    setSidebarContent(content);
  }, []);

  const contextValue = useMemo<LayoutContextValue>(
    () => ({
      sidebar: sidebarContent,
      setSidebar,
    }),
    [setSidebar, sidebarContent],
  );

  return (
    <LayoutContext.Provider value={contextValue}>
      <div className={cn('h-viewport flex flex-col', className)}>
        {showHeader && <Header onLogout={onLogout} userName={userName} isAuthPage={isAuthPage} />}

        <div className="flex min-h-0 flex-1">
          {sidebarContent ? (
            <div className="relative h-full flex-shrink-0">{sidebarContent}</div>
          ) : null}

          <main
            className={cn(
              'relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-secondary dark:bg-surface-dark',
              contentClassName,
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
