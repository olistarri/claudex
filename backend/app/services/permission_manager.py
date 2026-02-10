import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class PendingRequest:
    request_data: dict[str, Any]
    event: asyncio.Event = field(default_factory=asyncio.Event)
    response: dict[str, Any] | None = None
    expires_at: float = 0.0


class PermissionManager:
    _pending: dict[str, PendingRequest] = {}

    @classmethod
    def _prune_expired(cls, now: float) -> None:
        expired_request_ids = [
            request_id
            for request_id, pending in cls._pending.items()
            if pending.expires_at <= now
        ]
        for request_id in expired_request_ids:
            cls._pending.pop(request_id, None)

    @classmethod
    def create_request(cls, request_id: str, request_data: dict[str, Any]) -> None:
        now = time.monotonic()
        expires_at = now + settings.PERMISSION_REQUEST_TTL_SECONDS
        cls._prune_expired(now)
        cls._pending[request_id] = PendingRequest(
            request_data=request_data,
            expires_at=expires_at,
        )

    @classmethod
    def get_request_data(cls, request_id: str) -> dict[str, Any] | None:
        cls._prune_expired(time.monotonic())
        pending = cls._pending.get(request_id)
        if pending is None:
            return None
        return pending.request_data

    @classmethod
    async def wait_for_response(
        cls, request_id: str, timeout: float
    ) -> dict[str, Any] | None:
        now = time.monotonic()
        cls._prune_expired(now)
        pending = cls._pending.get(request_id)
        if pending is None:
            return None
        remaining_ttl = pending.expires_at - now
        if remaining_ttl <= 0:
            cls._pending.pop(request_id, None)
            return None
        wait_timeout = max(min(timeout, remaining_ttl), 0.0)

        try:
            await asyncio.wait_for(pending.event.wait(), timeout=wait_timeout)
        except asyncio.TimeoutError:
            cls._pending.pop(request_id, None)
            return None

        pending = cls._pending.pop(request_id, None)
        if pending is None:
            return None
        return pending.response

    @classmethod
    async def respond(
        cls,
        request_id: str,
        approved: bool,
        alternative_instruction: str | None = None,
        user_answers: dict[str, Any] | None = None,
    ) -> bool:
        cls._prune_expired(time.monotonic())
        pending = cls._pending.get(request_id)
        if pending is None:
            logger.warning("Permission request %s not found or expired", request_id)
            return False

        pending.response = {
            "approved": approved,
            "alternative_instruction": alternative_instruction,
            "user_answers": user_answers,
        }
        pending.event.set()
        return True

    @classmethod
    def remove(cls, request_id: str) -> None:
        cls._pending.pop(request_id, None)
