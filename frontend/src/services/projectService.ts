import { apiClient } from '@/lib/api';
import { ensureResponse, serviceCall } from '@/services/base';
import type { Project, ProjectCreate, ProjectUpdate, ProjectSettingsUpdate } from '@/types';

async function listProjects(): Promise<Project[]> {
  return serviceCall(async () => {
    const response = await apiClient.get<Project[]>('/projects');
    return response ?? [];
  });
}

async function getProject(projectId: string): Promise<Project> {
  return serviceCall(async () => {
    const response = await apiClient.get<Project>(`/projects/${projectId}`);
    return ensureResponse(response, 'Failed to fetch project');
  });
}

async function createProject(data: ProjectCreate): Promise<Project> {
  return serviceCall(async () => {
    const response = await apiClient.post<Project>('/projects', data);
    return ensureResponse(response, 'Failed to create project');
  });
}

async function updateProject(projectId: string, data: ProjectUpdate): Promise<Project> {
  return serviceCall(async () => {
    const response = await apiClient.patch<Project>(`/projects/${projectId}`, data);
    return ensureResponse(response, 'Failed to update project');
  });
}

async function deleteProject(projectId: string): Promise<void> {
  await serviceCall(async () => {
    await apiClient.delete(`/projects/${projectId}`);
  });
}

async function updateProjectSettings(
  projectId: string,
  data: ProjectSettingsUpdate,
): Promise<Project> {
  return serviceCall(async () => {
    const response = await apiClient.patch<Project>(`/projects/${projectId}/settings`, data);
    return ensureResponse(response, 'Failed to update project settings');
  });
}

export const projectService = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  updateProjectSettings,
};
