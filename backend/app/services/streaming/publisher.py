from __future__ import annotations

import json
import logging
from typing import Any

from redis.asyncio import Redis

from app.constants import REDIS_KEY_CHAT_STREAM_LIVE
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class StreamPublisher:
    def __init__(self, chat_id: str) -> None:
        self.chat_id = chat_id
        self._redis: Redis[str] | None = None

    async def connect(self) -> None:
        try:
            self._redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as exc:
            logger.error("Failed to connect to Redis: %s", exc)
            if self._redis:
                try:
                    await self._redis.close()
                except Exception:
                    logger.debug("Error closing Redis client during connect rollback")
            self._redis = None

    @property
    def redis(self) -> Redis[str] | None:
        return self._redis

    async def publish(self, payload: dict[str, Any] | str | None = None) -> None:
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

    async def publish_envelope(self, envelope: dict[str, Any]) -> None:
        await self.publish(envelope)

    async def cleanup(self) -> None:
        if not self._redis:
            return

        try:
            await self._redis.close()
        except Exception as exc:
            logger.debug("Error closing Redis client: %s", exc)

        self._redis = None
