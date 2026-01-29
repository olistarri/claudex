import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID, uuid4

from redis.exceptions import WatchError
from tenacity import retry, retry_if_exception_type, stop_after_attempt

from app.constants import (
    QUEUE_MESSAGE_TTL_SECONDS,
    REDIS_KEY_CHAT_QUEUE,
)
from app.models.schemas.queue import QueuedMessage, QueueUpsertResponse

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class QueueService:
    def __init__(self, redis_client: "Redis[str]"):
        self.redis = redis_client

    def _queue_key(self, chat_id: str) -> str:
        return REDIS_KEY_CHAT_QUEUE.format(chat_id=chat_id)

    @retry(
        retry=retry_if_exception_type(WatchError),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    async def upsert_message(
        self,
        chat_id: str,
        content: str,
        model_id: str,
        permission_mode: str = "auto",
        thinking_mode: str | None = None,
        attachments: list[dict[str, Any]] | None = None,
    ) -> QueueUpsertResponse:
        key = self._queue_key(chat_id)

        async with self.redis.pipeline(transaction=True) as pipe:
            await pipe.watch(key)
            raw = await pipe.get(key)

            if raw:
                data = json.loads(raw)
                data["content"] = data["content"] + "\n" + content
                data["model_id"] = model_id
                data["permission_mode"] = permission_mode
                if thinking_mode is not None:
                    data["thinking_mode"] = thinking_mode

                if attachments:
                    existing_attachments = data.get("attachments") or []
                    data["attachments"] = existing_attachments + attachments

                pipe.multi()
                pipe.set(key, json.dumps(data), ex=QUEUE_MESSAGE_TTL_SECONDS)
                await pipe.execute()

                return QueueUpsertResponse(
                    id=UUID(data["id"]),
                    created=False,
                    content=data["content"],
                    attachments=data.get("attachments"),
                )

            message_id = uuid4()
            message_data: dict[str, Any] = {
                "id": str(message_id),
                "content": content,
                "model_id": model_id,
                "permission_mode": permission_mode,
                "thinking_mode": thinking_mode,
                "queued_at": datetime.now(timezone.utc).isoformat(),
                "attachments": attachments,
            }

            pipe.multi()
            pipe.set(key, json.dumps(message_data), ex=QUEUE_MESSAGE_TTL_SECONDS)
            await pipe.execute()

            return QueueUpsertResponse(
                id=message_id,
                created=True,
                content=content,
                attachments=attachments,
            )

    async def get_message(self, chat_id: str) -> QueuedMessage | None:
        key = self._queue_key(chat_id)
        raw = await self.redis.get(key)

        if not raw:
            return None

        data = json.loads(raw)
        return QueuedMessage(
            id=UUID(data["id"]),
            content=data["content"],
            model_id=data["model_id"],
            permission_mode=data.get("permission_mode", "auto"),
            thinking_mode=data.get("thinking_mode"),
            queued_at=datetime.fromisoformat(data["queued_at"]),
            attachments=data.get("attachments"),
        )

    @retry(
        retry=retry_if_exception_type(WatchError),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    async def update_message(self, chat_id: str, content: str) -> QueuedMessage | None:
        key = self._queue_key(chat_id)

        async with self.redis.pipeline(transaction=True) as pipe:
            await pipe.watch(key)
            raw = await pipe.get(key)

            if not raw:
                await pipe.unwatch()
                return None

            data = json.loads(raw)
            data["content"] = content

            pipe.multi()
            pipe.set(key, json.dumps(data), ex=QUEUE_MESSAGE_TTL_SECONDS)
            await pipe.execute()

            return QueuedMessage(
                id=UUID(data["id"]),
                content=data["content"],
                model_id=data["model_id"],
                permission_mode=data.get("permission_mode", "auto"),
                thinking_mode=data.get("thinking_mode"),
                queued_at=datetime.fromisoformat(data["queued_at"]),
                attachments=data.get("attachments"),
            )

    async def clear_queue(self, chat_id: str) -> bool:
        key = self._queue_key(chat_id)
        deleted = await self.redis.delete(key)
        return deleted > 0

    async def pop_next_message(self, chat_id: str) -> dict[str, Any] | None:
        key = self._queue_key(chat_id)
        raw = await self.redis.getdel(key)

        if not raw:
            return None

        return cast(dict[str, Any], json.loads(raw))
