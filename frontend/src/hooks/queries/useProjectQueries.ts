import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { projectService } from '@/services/projectService';
import type { Project, ProjectCreate, ProjectUpdate, ProjectSettingsUpdate } from '@/types';
import { queryKeys } from './queryKeys';

export const useProjectsQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [queryKeys.projects],
    queryFn: () => projectService.listProjects(),
    enabled: options?.enabled ?? true,
  });
};

export const useProjectQuery = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
  });
};

export const useCreateProjectMutation = (
  options?: UseMutationOptions<Project, Error, ProjectCreate>,
) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (data: ProjectCreate) => projectService.createProject(data),
    onSuccess: async (newProject, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.projects] });
      if (onSuccess) {
        await onSuccess(newProject, variables, context, mutation);
      }
    },
    ...restOptions,
  });
};

export const useUpdateProjectMutation = (
  options?: UseMutationOptions<Project, Error, { projectId: string; data: ProjectUpdate }>,
) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: ({ projectId, data }) => projectService.updateProject(projectId, data),
    onSuccess: async (updatedProject, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.projects] });
      queryClient.setQueryData(queryKeys.project(updatedProject.id), updatedProject);
      if (onSuccess) {
        await onSuccess(updatedProject, variables, context, mutation);
      }
    },
    ...restOptions,
  });
};

export const useDeleteProjectMutation = (
  options?: UseMutationOptions<void, Error, string>,
) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (projectId: string) => projectService.deleteProject(projectId),
    onSuccess: async (data, projectId, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.projects] });
      if (onSuccess) {
        await onSuccess(data, projectId, context, mutation);
      }
    },
    ...restOptions,
  });
};

export const useUpdateProjectSettingsMutation = (
  options?: UseMutationOptions<
    Project,
    Error,
    { projectId: string; data: ProjectSettingsUpdate }
  >,
) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: ({ projectId, data }) => projectService.updateProjectSettings(projectId, data),
    onSuccess: async (updatedProject, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.projects] });
      queryClient.setQueryData(queryKeys.project(updatedProject.id), updatedProject);
      if (onSuccess) {
        await onSuccess(updatedProject, variables, context, mutation);
      }
    },
    ...restOptions,
  });
};
