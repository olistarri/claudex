import type {
  CustomAgent,
  CustomMcp,
  CustomEnvVar,
  CustomSkill,
  CustomCommand,
  CustomPrompt,
} from './user.types';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  folder_name: string;
  is_default: boolean;
  custom_instructions: string | null;
  custom_agents: CustomAgent[] | null;
  custom_mcps: CustomMcp[] | null;
  custom_env_vars: CustomEnvVar[] | null;
  custom_skills: CustomSkill[] | null;
  custom_slash_commands: CustomCommand[] | null;
  custom_prompts: CustomPrompt[] | null;
  git_repo_url: string | null;
  git_branch: string | null;
  setup_commands: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  folder_name: string;
}

export interface ProjectUpdate {
  name?: string;
}

export interface ProjectSettingsUpdate {
  custom_instructions?: string | null;
  custom_agents?: CustomAgent[] | null;
  custom_mcps?: CustomMcp[] | null;
  custom_env_vars?: CustomEnvVar[] | null;
  custom_skills?: CustomSkill[] | null;
  custom_slash_commands?: CustomCommand[] | null;
  custom_prompts?: CustomPrompt[] | null;
  git_repo_url?: string | null;
  git_branch?: string | null;
  setup_commands?: string[] | null;
}
