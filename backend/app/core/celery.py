import json
import logging
from typing import Any

from celery import Celery
from redis.asyncio import Redis

from app.constants import REDIS_KEY_CHAT_STREAM
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "claudex",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.chat_processor", "app.tasks.scheduler"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_default_queue="default",
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000,
    result_expires=settings.CELERY_RESULT_EXPIRES_SECONDS,
    task_ignore_result=False,
    broker_connection_retry_on_startup=True,
)

celery_app.conf.beat_schedule = {
    "check-scheduled-tasks-every-minute": {
        "task": "check_scheduled_tasks",
        "schedule": 60.0,
    },
    "cleanup-expired-refresh-tokens-daily": {
        "task": "cleanup_expired_refresh_tokens",
        "schedule": 86400.0,
    },
}


class SSEEventPublisher:
    def __init__(self, redis_client: "Redis[str]"):
        self.redis = redis_client
        self._stream_max_len = 10_000

    async def _publish_event(
        self, chat_id: str, event_type: str, data: str, event_id: str | None = None
    ) -> None:
        event: dict[str, Any] = {
            "type": event_type,
            "data": data,
        }
        if event_id:
            event["id"] = event_id

        channel = f"chat:{chat_id}"
        await self.redis.publish(channel, json.dumps(event))

        if event_id:
            await self.redis.setex(
                f"event:{chat_id}:{event_id}",
                settings.CELERY_RESULT_EXPIRES_SECONDS,
                json.dumps(event),
            )
        try:
            fields: dict[str, str | int | float] = {"kind": event_type}
            if data:
                fields["payload"] = data
            # XADD appends to Redis stream. maxlen caps size; approximate=True allows
            # slight overage for better performance (avoids trimming on every write).
            await self.redis.xadd(
                REDIS_KEY_CHAT_STREAM.format(chat_id=chat_id),
                fields,
                maxlen=self._stream_max_len,
                approximate=True,
            )
        except Exception as exc:
            logger.warning(
                f"Failed to append SSE event to stream for chat {chat_id}: {exc}"
            )

    async def publish_content(
        self, chat_id: str, content: str, event_id: str | None = None
    ) -> None:
        await self._publish_event(chat_id, "content", content, event_id)
