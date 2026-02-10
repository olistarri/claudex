from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from redis.asyncio import Redis

from app.constants import (
    REDIS_KEY_CHAT_REVOKED,
    REDIS_KEY_CHAT_STREAM_LIVE,
    REDIS_KEY_CHAT_TASK,
)
from app.core.config import get_settings
from app.models.db_models import StreamEventKind
from app.services.streaming.events import StreamEvent

if TYPE_CHECKING:
    from celery import Task

logger = logging.getLogger(__name__)
settings = get_settings()


class StreamPublisher:
    def __init__(self, chat_id: str) -> None:
        self.chat_id = chat_id
        self._redis: Redis[str] | None = None

    async def connect(self, task: Task[Any, Any]) -> None:
        try:
            self._redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
            await self._redis.setex(
                REDIS_KEY_CHAT_TASK.format(chat_id=self.chat_id),
                settings.TASK_TTL_SECONDS,
                task.request.id,
            )
        except Exception as exc:
            logger.error("Failed to connect to Redis: %s", exc)
            self._redis = None

    @property
    def redis(self) -> Redis[str] | None:
        return self._redis

    async def publish(
        self, _kind: str, payload: dict[str, Any] | str | None = None
    ) -> None:
        if not self._redis:
            return

        try:
            live_payload = (
                payload
                if isinstance(payload, str)
                else json.dumps(payload or {}, ensure_ascii=False)
            )
            await self._redis.publish(
                REDIS_KEY_CHAT_STREAM_LIVE.format(chat_id=self.chat_id),
                live_payload,
            )
        except Exception as exc:
            logger.warning(
                "Failed to publish live stream entry for chat %s: %s", self.chat_id, exc
            )

    async def publish_event(self, event: StreamEvent) -> None:
        await self.publish(StreamEventKind.CONTENT.value, {"event": event})

    async def publish_envelope(self, envelope: dict[str, Any]) -> None:
        await self.publish(StreamEventKind.STREAM.value, envelope)

    async def publish_complete(self) -> None:
        await self.publish(StreamEventKind.COMPLETE.value)

    async def publish_error(self, error: str) -> None:
        await self.publish(StreamEventKind.ERROR.value, {"error": error})

    async def publish_queue_event(
        self,
        queued_message_id: str,
        user_message_id: str,
        assistant_message_id: str,
        content: str,
        model_id: str,
        attachments: list[dict[str, Any]] | None = None,
        injected_inline: bool = False,
    ) -> None:
        event_type = (
            StreamEventKind.QUEUE_INJECTED.value
            if injected_inline
            else StreamEventKind.QUEUE_PROCESSING.value
        )
        payload: dict[str, Any] = {
            "queued_message_id": queued_message_id,
            "user_message_id": user_message_id,
            "assistant_message_id": assistant_message_id,
            "content": content,
            "model_id": model_id,
            "attachments": attachments,
        }
        if injected_inline:
            payload["injected_inline"] = True
        await self.publish(event_type, payload)

    async def clear_stream(self) -> None:
        return

    async def cleanup(self) -> None:
        if not self._redis:
            return

        try:
            await self._redis.delete(REDIS_KEY_CHAT_TASK.format(chat_id=self.chat_id))
            await self._redis.delete(
                REDIS_KEY_CHAT_REVOKED.format(chat_id=self.chat_id)
            )
        except Exception as exc:
            logger.error("Failed to cleanup Redis keys: %s", exc)

        try:
            await self._redis.close()
        except Exception as exc:
            logger.debug("Error closing Redis client: %s", exc)

        self._redis = None
