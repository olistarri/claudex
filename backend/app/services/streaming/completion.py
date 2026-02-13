from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select

from app.models.db_models import Message, MessageRole, MessageStreamStatus
from app.prompts.system_prompt import build_system_prompt_for_chat
from app.services.message import MessageService
from app.services.queue import QueueService
from app.services.streaming.types import ChatStreamRequest
from app.services.user import UserService
from app.utils.redis import redis_connection

if TYPE_CHECKING:
    from app.services.claude_agent import ClaudeAgentService
    from app.services.streaming.runtime import ChatStreamRuntime

logger = logging.getLogger(__name__)


class StreamCompletionHandler:
    def __init__(
        self,
        *,
        runtime: ChatStreamRuntime,
        ai_service: ClaudeAgentService,
    ) -> None:
        self._runtime = runtime
        self._ai_service = ai_service

    async def create_checkpoint(self) -> None:
        rt = self._runtime
        if not (rt.sandbox_service and rt.chat.sandbox_id and rt.assistant_message_id):
            return

        try:
            checkpoint_id = await rt.sandbox_service.create_checkpoint(
                rt.chat.sandbox_id, rt.assistant_message_id
            )
            if not checkpoint_id:
                return

            async with rt.session_factory() as db:
                message_uuid = UUID(rt.assistant_message_id)
                query = select(Message).filter(Message.id == message_uuid)
                result = await db.execute(query)
                message = result.scalar_one_or_none()
                if message:
                    message.checkpoint_id = checkpoint_id
                    db.add(message)
                    await db.commit()
        except Exception as exc:
            logger.warning("Failed to create checkpoint: %s", exc)

    async def process_next_queued(self) -> bool:
        rt = self._runtime
        try:
            async with redis_connection() as redis:
                queue_service = QueueService(redis)
                next_msg = await queue_service.pop_next_message(rt.chat_id)
            if not next_msg:
                return False

            message_service = rt.message_service
            user_message = await message_service.create_message(
                UUID(rt.chat_id),
                next_msg["content"],
                MessageRole.USER,
                attachments=next_msg.get("attachments"),
            )
            assistant_message = await message_service.create_message(
                UUID(rt.chat_id),
                "",
                MessageRole.ASSISTANT,
                model_id=next_msg["model_id"],
                stream_status=MessageStreamStatus.IN_PROGRESS,
            )

            await rt._emit_event(
                "queue_processing",
                {
                    "queued_message_id": next_msg["id"],
                    "user_message_id": str(user_message.id),
                    "assistant_message_id": str(assistant_message.id),
                    "content": next_msg["content"],
                    "model_id": next_msg["model_id"],
                    "attachments": MessageService.serialize_attachments(
                        next_msg, user_message
                    ),
                },
                apply_snapshot=False,
            )

            user_service = UserService(session_factory=rt.session_factory)
            user_settings = await user_service.get_user_settings(
                rt.chat.user_id, db=None
            )

            system_prompt = build_system_prompt_for_chat(
                rt.chat.sandbox_id or "",
                user_settings,
            )

            from app.services.streaming.runtime import ChatStreamRuntime

            ChatStreamRuntime.start_background_chat(
                ChatStreamRequest(
                    prompt=next_msg["content"],
                    system_prompt=system_prompt,
                    custom_instructions=(
                        user_settings.custom_instructions if user_settings else None
                    ),
                    chat_data={
                        "id": rt.chat_id,
                        "user_id": str(rt.chat.user_id),
                        "title": rt.chat.title,
                        "sandbox_id": rt.chat.sandbox_id,
                        "session_id": rt.chat.session_id,
                    },
                    permission_mode=next_msg.get("permission_mode", "auto"),
                    model_id=next_msg["model_id"],
                    session_id=rt.chat.session_id,
                    assistant_message_id=str(assistant_message.id),
                    thinking_mode=next_msg.get("thinking_mode"),
                    attachments=next_msg.get("attachments"),
                    is_custom_prompt=False,
                )
            )

            logger.info(
                "Queued message %s for chat %s has been processed",
                next_msg["id"],
                rt.chat_id,
            )
            return True

        except Exception as exc:
            logger.error("Failed to process queued message: %s", exc)
            return False

    async def emit_final_context_usage(self) -> None:
        rt = self._runtime
        session_id = (
            rt.session_container.get("session_id")
            if rt.session_container
            else rt.chat.session_id
        )
        if (
            not session_id
            or not rt.sandbox_id
            or not rt.user_id
            or not rt.model_id
            or not rt._redis
        ):
            return

        from app.services.streaming.context_usage import ContextUsagePoller

        await ContextUsagePoller(runtime=rt).refresh(
            ai_service=self._ai_service,
            session_id=str(session_id),
        )
