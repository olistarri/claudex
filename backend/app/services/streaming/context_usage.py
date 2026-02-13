from __future__ import annotations

import asyncio
import json
import logging
from contextlib import suppress
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import select

from app.constants import REDIS_KEY_CHAT_CONTEXT_USAGE
from app.core.config import get_settings
from app.models.db_models import Chat
from app.services.user import UserService

if TYPE_CHECKING:
    from app.services.claude_agent import ClaudeAgentService
    from app.services.streaming.runtime import ChatStreamRuntime

logger = logging.getLogger(__name__)
settings = get_settings()


class ContextUsagePoller:
    def __init__(self, *, runtime: ChatStreamRuntime) -> None:
        self._runtime = runtime

    def start(
        self, ai_service: ClaudeAgentService
    ) -> tuple[asyncio.Task[None] | None, asyncio.Event | None]:
        rt = self._runtime
        if not rt._redis or not rt.sandbox_id:
            return None, None

        stop_event = asyncio.Event()
        poll_task = asyncio.create_task(self._poll(ai_service, stop_event))
        return poll_task, stop_event

    async def refresh(
        self,
        *,
        ai_service: ClaudeAgentService,
        session_id: str,
    ) -> dict[str, Any] | None:
        rt = self._runtime
        redis_client = rt._redis
        if not redis_client:
            return None
        try:
            user_settings = await UserService(
                session_factory=rt.session_factory
            ).get_user_settings(UUID(rt.user_id))
            token_usage = await ai_service.get_context_token_usage(
                session_id=session_id,
                sandbox_id=rt.sandbox_id,
                model_id=rt.model_id,
                user_settings=user_settings,
            )
            if token_usage is None:
                return None

            context_window = settings.CONTEXT_WINDOW_TOKENS
            percentage = (
                min((token_usage / context_window) * 100, 100.0)
                if context_window > 0
                else 0.0
            )
            context_data: dict[str, Any] = {
                "tokens_used": token_usage,
                "context_window": context_window,
                "percentage": percentage,
            }

            async with rt.session_factory() as db:
                result = await db.execute(select(Chat).filter(Chat.id == rt.chat.id))
                chat = result.scalar_one_or_none()
                if chat:
                    chat.context_token_usage = token_usage
                    db.add(chat)
                    await db.commit()

            await redis_client.setex(
                REDIS_KEY_CHAT_CONTEXT_USAGE.format(chat_id=rt.chat_id),
                settings.CONTEXT_USAGE_CACHE_TTL_SECONDS,
                json.dumps(context_data),
            )

            if rt.assistant_message_id:
                payload: dict[str, Any] = {
                    "context_usage": context_data,
                    "chat_id": rt.chat_id,
                }
                await rt._emit_event("system", payload, apply_snapshot=False)

            return context_data
        except Exception as exc:
            logger.debug(
                "Context usage refresh failed for chat %s: %s", rt.chat_id, exc
            )
            return None

    @staticmethod
    async def stop(
        poll_task: asyncio.Task[None] | None,
        stop_event: asyncio.Event | None,
    ) -> None:
        if stop_event:
            stop_event.set()
        if not poll_task:
            return
        poll_task.cancel()
        with suppress(asyncio.CancelledError):
            await poll_task

    async def _poll(
        self,
        ai_service: ClaudeAgentService,
        stop_event: asyncio.Event,
    ) -> None:
        rt = self._runtime
        if not rt._redis:
            return

        while not stop_event.is_set():
            session_id = rt.session_container.get("session_id")
            if session_id:
                try:
                    await self.refresh(
                        ai_service=ai_service,
                        session_id=str(session_id),
                    )
                except Exception as exc:
                    logger.debug(
                        "Mid-stream context usage polling failed for chat %s: %s",
                        rt.chat_id,
                        exc,
                    )

            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=settings.CONTEXT_USAGE_POLL_INTERVAL_SECONDS,
                )
            except asyncio.TimeoutError:
                continue
