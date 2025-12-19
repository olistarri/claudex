import json
import logging
from typing import Any

from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class PermissionManager:
    def __init__(self, redis_client: "Redis[str]"):
        self.redis = redis_client

    async def respond_to_permission(
        self,
        request_id: str,
        approved: bool,
        alternative_instruction: str | None = None,
        user_answers: dict[str, Any] | None = None,
    ) -> bool:
        request_data = await self.redis.get(f"permission_request:{request_id}")
        if not request_data:
            logger.warning("Permission request %s not found or expired", request_id)
            return False

        try:
            response = {
                "approved": approved,
                "alternative_instruction": alternative_instruction,
                "user_answers": user_answers,
            }
            await self.redis.publish(
                f"permission_response:{request_id}", json.dumps(response)
            )
            return True
        except Exception as e:
            logger.error("Error responding to permission: %s", e)
            return False
