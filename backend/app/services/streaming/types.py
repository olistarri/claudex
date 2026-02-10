from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.models.db_models import Chat


@dataclass(kw_only=True)
class ChatStreamRequest:
    prompt: str
    system_prompt: str
    custom_instructions: str | None
    chat_data: dict[str, Any]
    model_id: str
    permission_mode: str
    session_id: str | None
    assistant_message_id: str | None
    thinking_mode: str | None
    attachments: list[dict[str, Any]] | None
    is_custom_prompt: bool = False


@dataclass(kw_only=True)
class ChatStreamState:
    chat: Chat
    chat_id: str
    chat_uuid: UUID
    stream_id: UUID
    sandbox_id: str
    session_container: dict[str, Any]
