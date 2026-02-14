import uuid
from uuid import UUID

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.types import GUID
from app.models.types import (
    CustomAgentDict,
    CustomEnvVarDict,
    CustomMcpDict,
    CustomPromptDict,
    CustomSkillDict,
    CustomSlashCommandDict,
)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    folder_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_agents: Mapped[list[CustomAgentDict] | None] = mapped_column(
        JSON, nullable=True
    )
    custom_mcps: Mapped[list[CustomMcpDict] | None] = mapped_column(
        JSON, nullable=True
    )
    custom_env_vars: Mapped[list[CustomEnvVarDict] | None] = mapped_column(
        JSON, nullable=True
    )
    custom_skills: Mapped[list[CustomSkillDict] | None] = mapped_column(
        JSON, nullable=True
    )
    custom_slash_commands: Mapped[list[CustomSlashCommandDict] | None] = mapped_column(
        JSON, nullable=True
    )
    custom_prompts: Mapped[list[CustomPromptDict] | None] = mapped_column(
        JSON, nullable=True
    )
    git_repo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    git_branch: Mapped[str | None] = mapped_column(String(128), nullable=True)
    setup_commands: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    user = relationship("User", back_populates="projects")
    chats = relationship("Chat", back_populates="project")

    __table_args__ = (
        UniqueConstraint("user_id", "folder_name", name="uq_projects_user_folder"),
        Index("idx_projects_user_id", "user_id"),
    )
