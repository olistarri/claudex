import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Settings2, FolderOpen } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useProjectStore } from '@/store';
import { useProjectsQuery } from '@/hooks/queries';
import type { Project } from '@/types';

export function ProjectSelector() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const setActiveProjectId = useProjectStore((state) => state.setActiveProjectId);

  const { data: projects } = useProjectsQuery();

  const activeProject = projects?.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (projects?.length && !activeProject) {
      const defaultProject = projects.find((p) => p.is_default) ?? projects[0];
      setActiveProjectId(defaultProject.id);
    }
  }, [projects, activeProject, setActiveProjectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (project: Project) => {
    setActiveProjectId(project.id);
    setIsOpen(false);
  };

  const handleManageProjects = () => {
    setIsOpen(false);
    navigate('/settings?tab=projects');
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5',
          'text-xs font-medium text-text-secondary dark:text-text-dark-secondary',
          'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
          'transition-colors duration-200',
        )}
      >
        <FolderOpen className="h-3 w-3 text-text-tertiary dark:text-text-dark-tertiary" />
        <span className="truncate">{activeProject?.name ?? 'Select project'}</span>
        <ChevronDown
          className={cn(
            'ml-auto h-3 w-3 text-text-quaternary dark:text-text-dark-quaternary',
            'transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1',
            'rounded-xl border border-border/50 dark:border-border-dark/50',
            'bg-surface-secondary/95 dark:bg-surface-dark-secondary/95',
            'shadow-medium backdrop-blur-xl',
            'max-h-64 overflow-y-auto',
          )}
        >
          <div className="p-1">
            {projects?.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5',
                  'text-xs text-text-primary dark:text-text-dark-primary',
                  'transition-colors duration-200',
                  project.id === activeProjectId
                    ? 'bg-surface-active dark:bg-surface-dark-active'
                    : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
                )}
              >
                <FolderOpen className="h-3 w-3 text-text-tertiary dark:text-text-dark-tertiary" />
                <span className="truncate">{project.name}</span>
                {project.is_default && (
                  <span className="ml-auto text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                    default
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border/50 p-1 dark:border-border-dark/50">
            <button
              onClick={handleManageProjects}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5',
                'text-xs text-text-secondary dark:text-text-dark-secondary',
                'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
                'transition-colors duration-200',
              )}
            >
              <Settings2 className="h-3 w-3" />
              Manage projects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
