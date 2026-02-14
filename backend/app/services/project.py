import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import func, select

from app.constants import MAX_PROJECTS_PER_USER
from app.core.config import get_settings
from app.models.db_models import Chat, Project, UserSettings
from app.models.schemas.project import (
    ProjectCreate,
    ProjectSettingsUpdate,
    ProjectUpdate,
)
from app.services.db import BaseDbService, SessionFactoryType
from app.services.exceptions import ChatException, ErrorCode

settings = get_settings()
logger = logging.getLogger(__name__)


@dataclass
class MergedSettings:
    custom_instructions: str | None = None
    custom_agents: list[dict] | None = None
    custom_mcps: list[dict] | None = None
    custom_env_vars: list[dict] | None = None
    custom_skills: list[dict] | None = None
    custom_slash_commands: list[dict] | None = None
    custom_prompts: list[dict] | None = None
    sandbox_provider: str = "docker"
    github_personal_access_token: str | None = None
    e2b_api_key: str | None = None
    modal_api_key: str | None = None
    custom_providers: list[dict] | None = None
    auto_compact_disabled: bool = False
    attribution_disabled: bool = False
    notification_sound_enabled: bool = True
    gmail_oauth_client: dict | None = None
    gmail_oauth_tokens: dict | None = None


class ProjectService(BaseDbService[Project]):
    def __init__(self, session_factory: SessionFactoryType | None = None) -> None:
        super().__init__(session_factory)

    async def get_user_projects(self, user_id: UUID) -> list[Project]:
        async with self.session_factory() as db:
            result = await db.execute(
                select(Project)
                .filter(Project.user_id == user_id)
                .order_by(Project.is_default.desc(), Project.name)
            )
            return list(result.scalars().all())

    async def get_project(self, project_id: UUID, user_id: UUID) -> Project:
        async with self.session_factory() as db:
            result = await db.execute(
                select(Project).filter(
                    Project.id == project_id, Project.user_id == user_id
                )
            )
            project = result.scalar_one_or_none()
            if not project:
                raise ChatException(
                    "Project not found",
                    error_code=ErrorCode.CHAT_NOT_FOUND,
                    details={"project_id": str(project_id)},
                    status_code=404,
                )
            return project

    async def create_project(
        self, user_id: UUID, data: ProjectCreate
    ) -> Project:
        async with self.session_factory() as db:
            count_result = await db.execute(
                select(func.count(Project.id)).filter(Project.user_id == user_id)
            )
            count = count_result.scalar() or 0
            if count >= MAX_PROJECTS_PER_USER:
                raise ChatException(
                    f"Maximum of {MAX_PROJECTS_PER_USER} projects allowed",
                    error_code=ErrorCode.VALIDATION_ERROR,
                    status_code=400,
                )

            existing = await db.execute(
                select(Project).filter(
                    Project.user_id == user_id,
                    Project.folder_name == data.folder_name,
                )
            )
            if existing.scalar_one_or_none():
                raise ChatException(
                    f"A project with folder name '{data.folder_name}' already exists",
                    error_code=ErrorCode.VALIDATION_ERROR,
                    status_code=409,
                )

            project_dir = Path(settings.PROJECTS_ROOT_DIR) / data.folder_name
            project_dir.mkdir(parents=True, exist_ok=True)

            project = Project(
                user_id=user_id,
                name=data.name,
                folder_name=data.folder_name,
            )
            db.add(project)
            await db.commit()
            await db.refresh(project)
            return project

    async def update_project(
        self, project_id: UUID, user_id: UUID, data: ProjectUpdate
    ) -> Project:
        async with self.session_factory() as db:
            result = await db.execute(
                select(Project).filter(
                    Project.id == project_id, Project.user_id == user_id
                )
            )
            project = result.scalar_one_or_none()
            if not project:
                raise ChatException(
                    "Project not found",
                    error_code=ErrorCode.CHAT_NOT_FOUND,
                    details={"project_id": str(project_id)},
                    status_code=404,
                )

            if data.name is not None:
                project.name = data.name

            project.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(project)
            return project

    async def delete_project(self, project_id: UUID, user_id: UUID) -> None:
        async with self.session_factory() as db:
            result = await db.execute(
                select(Project).filter(
                    Project.id == project_id, Project.user_id == user_id
                )
            )
            project = result.scalar_one_or_none()
            if not project:
                raise ChatException(
                    "Project not found",
                    error_code=ErrorCode.CHAT_NOT_FOUND,
                    details={"project_id": str(project_id)},
                    status_code=404,
                )

            if project.is_default:
                raise ChatException(
                    "Cannot delete the default project",
                    error_code=ErrorCode.VALIDATION_ERROR,
                    status_code=400,
                )

            default_project = await self._get_default_project(user_id, db)

            await db.execute(
                Chat.__table__.update()
                .where(Chat.project_id == project_id)
                .values(project_id=default_project.id)
            )

            await db.delete(project)
            await db.commit()

    async def update_project_settings(
        self, project_id: UUID, user_id: UUID, data: ProjectSettingsUpdate
    ) -> Project:
        async with self.session_factory() as db:
            result = await db.execute(
                select(Project).filter(
                    Project.id == project_id, Project.user_id == user_id
                )
            )
            project = result.scalar_one_or_none()
            if not project:
                raise ChatException(
                    "Project not found",
                    error_code=ErrorCode.CHAT_NOT_FOUND,
                    details={"project_id": str(project_id)},
                    status_code=404,
                )

            update_data = data.model_dump(exclude_unset=True)
            for attr, value in update_data.items():
                setattr(project, attr, value)

            project.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(project)
            return project

    async def ensure_default_project(self, user_id: UUID) -> Project:
        async with self.session_factory() as db:
            result = await db.execute(
                select(Project).filter(
                    Project.user_id == user_id, Project.is_default.is_(True)
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                return existing

            project = Project(
                user_id=user_id,
                name="Default",
                folder_name="default",
                is_default=True,
            )
            db.add(project)
            await db.commit()
            await db.refresh(project)
            return project

    async def _get_default_project(self, user_id: UUID, db) -> Project:
        result = await db.execute(
            select(Project).filter(
                Project.user_id == user_id, Project.is_default.is_(True)
            )
        )
        project = result.scalar_one_or_none()
        if not project:
            project = Project(
                user_id=user_id,
                name="Default",
                folder_name="default",
                is_default=True,
            )
            db.add(project)
            await db.flush()
        return project

    @staticmethod
    def merge_settings(
        user_settings: UserSettings, project: Project | None
    ) -> MergedSettings:
        merged = MergedSettings(
            custom_instructions=user_settings.custom_instructions,
            custom_agents=user_settings.custom_agents,
            custom_mcps=user_settings.custom_mcps,
            custom_env_vars=user_settings.custom_env_vars,
            custom_skills=user_settings.custom_skills,
            custom_slash_commands=user_settings.custom_slash_commands,
            custom_prompts=user_settings.custom_prompts,
            sandbox_provider=user_settings.sandbox_provider,
            github_personal_access_token=user_settings.github_personal_access_token,
            e2b_api_key=user_settings.e2b_api_key,
            modal_api_key=user_settings.modal_api_key,
            custom_providers=user_settings.custom_providers,
            auto_compact_disabled=user_settings.auto_compact_disabled,
            attribution_disabled=user_settings.attribution_disabled,
            notification_sound_enabled=user_settings.notification_sound_enabled,
            gmail_oauth_client=user_settings.gmail_oauth_client,
            gmail_oauth_tokens=user_settings.gmail_oauth_tokens,
        )

        if not project:
            return merged

        if project.custom_instructions is not None:
            merged.custom_instructions = project.custom_instructions

        merged.custom_agents = _merge_by_name(
            user_settings.custom_agents, project.custom_agents
        )
        merged.custom_mcps = _merge_by_name(
            user_settings.custom_mcps, project.custom_mcps
        )
        merged.custom_env_vars = _merge_by_key(
            user_settings.custom_env_vars, project.custom_env_vars, "key"
        )
        merged.custom_skills = _merge_by_name(
            user_settings.custom_skills, project.custom_skills
        )
        merged.custom_slash_commands = _merge_by_name(
            user_settings.custom_slash_commands, project.custom_slash_commands
        )
        merged.custom_prompts = _merge_by_name(
            user_settings.custom_prompts, project.custom_prompts
        )

        return merged


def _merge_by_name(
    global_items: list[dict] | None,
    project_items: list[dict] | None,
) -> list[dict] | None:
    return _merge_by_key(global_items, project_items, "name")


def _merge_by_key(
    global_items: list[dict] | None,
    project_items: list[dict] | None,
    key_field: str,
) -> list[dict] | None:
    if not project_items:
        return global_items
    if not global_items:
        return project_items

    project_keys = {item.get(key_field) for item in project_items}
    merged = [
        item for item in global_items if item.get(key_field) not in project_keys
    ]
    merged.extend(project_items)
    return merged
