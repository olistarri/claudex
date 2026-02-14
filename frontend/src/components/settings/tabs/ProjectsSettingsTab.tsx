import { useState } from 'react';
import { FolderOpen, Plus, Loader2, Edit2, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog } from '@/components/ui';
import { cn } from '@/utils/cn';
import {
  useProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useUpdateProjectSettingsMutation,
} from '@/hooks/queries';
import type { Project, ProjectSettingsUpdate } from '@/types';
import { ProjectDialog } from '@/components/settings/dialogs/ProjectDialog';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui/primitives/Spinner';

type ProjectSettingsField =
  | 'custom_instructions'
  | 'custom_agents'
  | 'custom_mcps'
  | 'custom_env_vars'
  | 'custom_skills'
  | 'custom_slash_commands'
  | 'custom_prompts';

const SETTINGS_FIELDS: { key: ProjectSettingsField; label: string }[] = [
  { key: 'custom_instructions', label: 'Instructions' },
  { key: 'custom_agents', label: 'Agents' },
  { key: 'custom_mcps', label: 'MCP Servers' },
  { key: 'custom_env_vars', label: 'Env Variables' },
  { key: 'custom_skills', label: 'Skills' },
  { key: 'custom_slash_commands', label: 'Commands' },
  { key: 'custom_prompts', label: 'Prompts' },
];

function getOverrideCount(project: Project): number {
  let count = 0;
  if (project.custom_instructions) count++;
  if (project.custom_agents?.length) count += project.custom_agents.length;
  if (project.custom_mcps?.length) count += project.custom_mcps.length;
  if (project.custom_env_vars?.length) count += project.custom_env_vars.length;
  if (project.custom_skills?.length) count += project.custom_skills.length;
  if (project.custom_slash_commands?.length) count += project.custom_slash_commands.length;
  if (project.custom_prompts?.length) count += project.custom_prompts.length;
  return count;
}

function ProjectSettingsPanel({
  project,
  onSave,
  isSaving,
}: {
  project: Project;
  onSave: (data: ProjectSettingsUpdate) => void;
  isSaving: boolean;
}) {
  const [instructions, setInstructions] = useState(project.custom_instructions ?? '');
  const [dirty, setDirty] = useState(false);

  const handleInstructionsChange = (value: string) => {
    setInstructions(value);
    setDirty(true);
  };

  const handleSave = () => {
    onSave({ custom_instructions: instructions || null });
    setDirty(false);
  };

  return (
    <div className="mt-4 space-y-4 border-t border-border/50 pt-4 dark:border-border-dark/50">
      <div>
        <h4 className="mb-3 text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
          Project Settings
        </h4>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-text-secondary dark:text-text-dark-secondary">
              Custom Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              placeholder="Add project-specific instructions..."
              rows={4}
              className={cn(
                'w-full rounded-lg border border-border/50 bg-surface px-3 py-2',
                'text-xs text-text-primary placeholder:text-text-quaternary',
                'focus:border-border-hover focus:outline-none focus:ring-1 focus:ring-text-quaternary/30',
                'dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark-primary',
                'dark:placeholder:text-text-dark-quaternary dark:focus:border-border-dark-hover',
                'dark:focus:ring-text-dark-quaternary/30',
                'transition-colors duration-200',
              )}
            />
          </div>

          {SETTINGS_FIELDS.filter((f) => f.key !== 'custom_instructions').map((field) => {
            const items = project[field.key] as unknown[] | null;
            const count = items?.length ?? 0;
            return (
              <div
                key={field.key}
                className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 dark:border-border-dark/50"
              >
                <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
                  {field.label}
                </span>
                <span className="text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                  {count} {count === 1 ? 'override' : 'overrides'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {dirty && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            onClick={() => {
              setInstructions(project.custom_instructions ?? '');
              setDirty(false);
            }}
            variant="outline"
            size="sm"
          >
            Discard
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            variant="primary"
            size="sm"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ProjectsSettingsTab() {
  const { data: projects, isLoading } = useProjectsQuery();
  const createProject = useCreateProjectMutation();
  const updateProject = useUpdateProjectMutation();
  const deleteProject = useDeleteProjectMutation();
  const updateSettings = useUpdateProjectSettingsMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [dialogName, setDialogName] = useState('');
  const [dialogFolderName, setDialogFolderName] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const handleAdd = () => {
    setEditingProject(null);
    setDialogName('');
    setDialogFolderName('');
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setDialogName(project.name);
    setDialogFolderName(project.folder_name);
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingProject(null);
    setDialogError(null);
  };

  const handleSubmit = () => {
    if (!dialogName.trim()) {
      setDialogError('Name is required');
      return;
    }

    if (editingProject) {
      updateProject.mutate(
        { projectId: editingProject.id, data: { name: dialogName.trim() } },
        {
          onSuccess: () => {
            toast.success('Project renamed');
            handleDialogClose();
          },
          onError: (err) => setDialogError(err.message),
        },
      );
    } else {
      if (!dialogFolderName.trim()) {
        setDialogError('Folder name is required');
        return;
      }
      createProject.mutate(
        { name: dialogName.trim(), folder_name: dialogFolderName.trim() },
        {
          onSuccess: () => {
            toast.success('Project created');
            handleDialogClose();
          },
          onError: (err) => setDialogError(err.message),
        },
      );
    }
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteProject) return;
    deleteProject.mutate(pendingDeleteProject.id, {
      onSuccess: () => {
        toast.success('Project deleted');
        if (expandedProjectId === pendingDeleteProject.id) {
          setExpandedProjectId(null);
        }
        setPendingDeleteProject(null);
      },
      onError: (err) => {
        toast.error(err.message);
        setPendingDeleteProject(null);
      },
    });
  };

  const handleSaveSettings = (projectId: string, data: ProjectSettingsUpdate) => {
    updateSettings.mutate(
      { projectId, data },
      {
        onSuccess: () => toast.success('Project settings saved'),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" className="text-text-quaternary dark:text-text-dark-quaternary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
              Projects
            </h2>
            <p className="mt-1 text-xs text-text-tertiary dark:text-text-dark-tertiary">
              Organize threads and settings by project. Each project maps to a folder on disk.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            variant="outline"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            disabled={(projects?.length ?? 0) >= 20}
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center dark:border-border-dark">
            <FolderOpen className="mx-auto mb-3 h-5 w-5 text-text-quaternary dark:text-text-dark-quaternary" />
            <p className="mb-3 text-xs text-text-tertiary dark:text-text-dark-tertiary">
              No projects yet
            </p>
            <Button type="button" onClick={handleAdd} variant="outline" size="sm">
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-border p-4 transition-all duration-200 hover:border-border-hover dark:border-border-dark dark:hover:border-border-dark-hover"
              >
                <div className="flex items-start justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedProjectId(
                        expandedProjectId === project.id ? null : project.id,
                      )
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />
                      <span className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
                        {project.name}
                      </span>
                      {project.is_default && (
                        <span className="rounded-md bg-surface-tertiary px-1.5 py-0.5 text-2xs text-text-quaternary dark:bg-surface-dark-tertiary dark:text-text-dark-quaternary">
                          default
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="font-mono text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                        {project.folder_name}
                      </span>
                      {getOverrideCount(project) > 0 && (
                        <span className="text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                          {getOverrideCount(project)} setting{getOverrideCount(project) !== 1 ? 's' : ''} overridden
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="ml-3 flex items-center gap-0.5">
                    <Button
                      type="button"
                      onClick={() => handleEdit(project)}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-text-quaternary hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary"
                      aria-label="Rename project"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {!project.is_default && (
                      <Button
                        type="button"
                        onClick={() => setPendingDeleteProject(project)}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-text-quaternary hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary"
                        aria-label="Delete project"
                        disabled={deleteProject.isPending}
                      >
                        {deleteProject.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {expandedProjectId === project.id && (
                  <ProjectSettingsPanel
                    project={project}
                    onSave={(data) => handleSaveSettings(project.id, data)}
                    isSaving={updateSettings.isPending}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectDialog
        isOpen={isDialogOpen}
        isEditing={!!editingProject}
        name={dialogName}
        folderName={dialogFolderName}
        error={dialogError}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        onNameChange={setDialogName}
        onFolderNameChange={setDialogFolderName}
      />

      <ConfirmDialog
        isOpen={!!pendingDeleteProject}
        onClose={() => setPendingDeleteProject(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        message={
          pendingDeleteProject
            ? `Are you sure you want to delete "${pendingDeleteProject.name}"? All threads will be moved to the default project.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
