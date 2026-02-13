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


class _CancelEntry:
    __slots__ = ("event", "expires_at")

    def __init__(self, event: asyncio.Event, expires_at: float | None = None) -> None:
        self.event = event
        self.expires_at = expires_at


class CancellationHandler:
    _entries: dict[str, _CancelEntry] = {}

    def __init__(self, chat_id: str, event: asyncio.Event | None = None) -> None:
        self.chat_id = chat_id
        self._event = event
        self.was_cancelled = False
        self.cancel_requested = False

    @classmethod
    def register(cls, chat_id: str) -> asyncio.Event:
        existing = cls._entries.get(chat_id)
        if existing is not None and existing.event.is_set():
            if existing.expires_at is None or existing.expires_at >= time.monotonic():
                existing.expires_at = None
                return existing.event
            cls._entries.pop(chat_id, None)

        event = asyncio.Event()
        cls._entries[chat_id] = _CancelEntry(event)
        return event

    @classmethod
    def unregister(cls, chat_id: str, event: asyncio.Event | None = None) -> None:
        entry = cls._entries.get(chat_id)
        if entry is not None and (event is None or event is entry.event):
            cls._entries.pop(chat_id, None)

    @classmethod
    def get_event(cls, chat_id: str) -> asyncio.Event | None:
        entry = cls._entries.get(chat_id)
        if entry is None:
            return None
        if entry.expires_at is not None and entry.expires_at < time.monotonic():
            cls._entries.pop(chat_id, None)
            return None
        return entry.event

    @classmethod
    def request_cancel(cls, chat_id: str) -> bool:
        entry = cls._entries.get(chat_id)
        if entry is None:
            event = asyncio.Event()
            ttl = max(float(settings.CANCEL_PENDING_TTL_SECONDS), 0.0)
            cls._entries[chat_id] = _CancelEntry(
                event, expires_at=time.monotonic() + ttl
            )
            event.set()
        else:
            entry.event.set()
        return True

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

        return asyncio.create_task(self._watch_cancel(event, main_task, ai_service))

    async def _watch_cancel(
        self,
        event: asyncio.Event,
        main_task: asyncio.Task[None] | None,
        ai_service: ClaudeAgentService,
    ) -> None:
        try:
            await event.wait()
        except asyncio.CancelledError:
            raise

        self.was_cancelled = True
        await self.cancel_stream(ai_service)

        if main_task:
            main_task.cancel()
