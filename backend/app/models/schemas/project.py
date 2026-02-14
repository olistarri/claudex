from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.schemas.settings import (
    CustomAgent,
    CustomEnvVar,
    CustomMcp,
    CustomPrompt,
    CustomSkill,
    CustomSlashCommand,
)
from app.models.types import JSONList
from app.utils.validators import normalize_json_list


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    folder_name: str = Field(
        ..., min_length=1, max_length=255, pattern=r"^[a-zA-Z0-9_\-\.]+$"
    )


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)


class ProjectSettingsUpdate(BaseModel):
    custom_instructions: str | None = Field(None, max_length=1500)
    custom_agents: list[CustomAgent] | None = None
    custom_mcps: list[CustomMcp] | None = None
    custom_env_vars: list[CustomEnvVar] | None = None
    custom_skills: list[CustomSkill] | None = None
    custom_slash_commands: list[CustomSlashCommand] | None = None
    custom_prompts: list[CustomPrompt] | None = None
    git_repo_url: str | None = Field(None, max_length=512)
    git_branch: str | None = Field(None, max_length=128)
    setup_commands: list[str] | None = None

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    folder_name: str
    is_default: bool
    custom_instructions: str | None = None
    custom_agents: list[CustomAgent] | None = None
    custom_mcps: list[CustomMcp] | None = None
    custom_env_vars: list[CustomEnvVar] | None = None
    custom_skills: list[CustomSkill] | None = None
    custom_slash_commands: list[CustomSlashCommand] | None = None
    custom_prompts: list[CustomPrompt] | None = None
    git_repo_url: str | None = None
    git_branch: str | None = None
    setup_commands: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
