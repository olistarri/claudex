from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.models.db_models import Chat, Message

logger = logging.getLogger(__name__)


class SessionUpdateCallback:
    def __init__(
        self,
        chat_id: str,
        assistant_message_id: str | None,
        session_factory: Any,
        session_container: dict[str, Any],
    ) -> None:
        self.chat_id = chat_id
        self.assistant_message_id = assistant_message_id
        self.session_factory = session_factory
        self.session_container = session_container
        self._pending_task: asyncio.Task[None] | None = None

    def __call__(self, new_session_id: str) -> None:
        self.session_container["session_id"] = new_session_id
        task = asyncio.create_task(self._update_session_id(new_session_id))
        self._pending_task = task
        task.add_done_callback(self._on_task_done)

    def _on_task_done(self, task: asyncio.Task[None]) -> None:
        if self._pending_task is task:
            self._pending_task = None
        if task.cancelled():
            return
        exc = task.exception()
        if exc:
            logger.error("Session ID update task failed: %s", exc)

    async def _update_session_id(self, session_id: str) -> None:
        if not self.session_factory:
            return

        try:
            async with self.session_factory() as db:
                chat_uuid = UUID(self.chat_id)
                chat_query = select(Chat).filter(Chat.id == chat_uuid)
                chat_result = await db.execute(chat_query)
                chat_record = chat_result.scalar_one_or_none()
                if chat_record:
                    chat_record.session_id = session_id
                    db.add(chat_record)

                if self.assistant_message_id:
                    message_uuid = UUID(self.assistant_message_id)
                    message_query = select(Message).filter(Message.id == message_uuid)
                    message_result = await db.execute(message_query)
                    message = message_result.scalar_one_or_none()
                    if message:
                        message.session_id = session_id
                        db.add(message)

                await db.commit()
        except Exception as exc:
            logger.error("Failed to update session_id: %s", exc)
