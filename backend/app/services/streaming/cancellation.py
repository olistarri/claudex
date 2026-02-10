from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

from app.core.config import get_settings

if TYPE_CHECKING:
    from app.services.claude_agent import ClaudeAgentService

logger = logging.getLogger(__name__)
settings = get_settings()


class StreamCancelled(Exception):
    def __init__(self, final_content: str) -> None:
        super().__init__("Stream cancelled")
        self.final_content = final_content


class CancellationHandler:
    _events: dict[str, asyncio.Event] = {}
    _pending: dict[str, float] = {}

    def __init__(self, chat_id: str, event: asyncio.Event | None = None) -> None:
        self.chat_id = chat_id
        self._event = event
        self.was_cancelled = False
        self.cancel_requested = False

    @classmethod
    def register(cls, chat_id: str) -> asyncio.Event:
        now = time.monotonic()
        cls._prune_pending(now)
        event = asyncio.Event()
        deadline = cls._pending.pop(chat_id, None)
        if deadline is not None and deadline >= now:
            event.set()
        cls._events[chat_id] = event
        return event

    @classmethod
    def unregister(cls, chat_id: str, event: asyncio.Event | None = None) -> None:
        current = cls._events.get(chat_id)
        if current is None:
            cls._pending.pop(chat_id, None)
            return
        if event is None or event is current:
            cls._events.pop(chat_id, None)
        cls._pending.pop(chat_id, None)

    @classmethod
    def get_event(cls, chat_id: str) -> asyncio.Event | None:
        cls._prune_pending(time.monotonic())
        return cls._events.get(chat_id)

    @classmethod
    def request_cancel(cls, chat_id: str) -> bool:
        now = time.monotonic()
        cls._prune_pending(now)
        event = cls._events.get(chat_id)
        if event is None:
            pending_ttl = max(float(settings.CANCEL_PENDING_TTL_SECONDS), 0.0)
            cls._pending[chat_id] = now + pending_ttl
            return True
        event.set()
        return True

    @classmethod
    def is_cancelled(cls, chat_id: str) -> bool:
        now = time.monotonic()
        cls._prune_pending(now)
        event = cls._events.get(chat_id)
        if event is not None and event.is_set():
            return True
        deadline = cls._pending.get(chat_id)
        return deadline is not None and deadline >= now

    @classmethod
    def _prune_pending(cls, now: float) -> None:
        expired_ids = [
            chat_id for chat_id, deadline in cls._pending.items() if deadline < now
        ]
        for chat_id in expired_ids:
            cls._pending.pop(chat_id, None)

    @classmethod
    async def wait_for_cancel(cls, chat_id: str) -> bool:
        event = cls.get_event(chat_id)
        if event is None:
            return False
        await event.wait()
        return True

    async def check_revoked(self) -> bool:
        return self.is_cancelled(self.chat_id)

    async def wait_for_revocation(self) -> None:
        event = self._event or self.get_event(self.chat_id)
        if event is None:
            return
        await event.wait()

    async def cancel_stream(self, ai_service: ClaudeAgentService) -> None:
        if self.cancel_requested:
            return

        self.cancel_requested = True
        try:
            await ai_service.cancel_active_stream()
        except Exception as exc:
            logger.error("Failed to cancel active stream: %s", exc)

    def create_monitor_task(
        self,
        main_task: asyncio.Task[None] | None,
        ai_service: ClaudeAgentService,
    ) -> asyncio.Task[None] | None:
        event = self._event or self.get_event(self.chat_id)
        if event is None:
            return None

        return asyncio.create_task(self._monitor_revocation(main_task, ai_service))

    async def _monitor_revocation(
        self,
        main_task: asyncio.Task[None] | None,
        ai_service: ClaudeAgentService,
    ) -> None:
        try:
            await self.wait_for_revocation()
        except asyncio.CancelledError:
            raise

        self.was_cancelled = True
        await self.cancel_stream(ai_service)

        if main_task:
            main_task.cancel()
