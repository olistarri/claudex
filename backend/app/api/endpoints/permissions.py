import asyncio
import json
import uuid
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from app.constants import (
    REDIS_KEY_CHAT_STREAM_LIVE,
    REDIS_KEY_PERMISSION_REQUEST,
    REDIS_KEY_PERMISSION_RESPONSE,
)
from app.core.config import get_settings
from app.core.security import validate_chat_scoped_token
from app.utils.redis import redis_connection, redis_pubsub
from app.models.schemas import (
    PermissionRequest,
    PermissionRequestResponse,
    PermissionResult,
)
from app.services.message import MessageService
from app.services.streaming.protocol import build_envelope, redact_for_audit

router = APIRouter()
settings = get_settings()


async def _validate_token_for_chat(authorization: str, chat_id: str) -> None:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    token = authorization.replace("Bearer ", "")
    if not validate_chat_scoped_token(token, chat_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired token for this chat",
        )


def _parse_response_payload(raw_payload: str) -> PermissionResult:
    try:
        data: dict[str, object] = json.loads(raw_payload)
        result: PermissionResult = PermissionResult.model_validate(data)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid response payload",
        ) from exc


@router.post(
    "/chats/{chat_id}/permissions/request",
    response_model=PermissionRequestResponse,
)
async def create_permission_request(
    chat_id: str,
    request: PermissionRequest,
    authorization: str = Header(...),
) -> PermissionRequestResponse:
    await _validate_token_for_chat(authorization, chat_id)

    async with redis_connection() as redis:
        request_id = str(uuid.uuid4())
        request_key = REDIS_KEY_PERMISSION_REQUEST.format(request_id=request_id)
        payload = json.dumps(
            {
                "chat_id": chat_id,
                "tool_name": request.tool_name,
                "tool_input": request.tool_input,
                "timestamp": asyncio.get_running_loop().time(),
            }
        )

        try:
            await redis.setex(
                request_key,
                settings.PERMISSION_REQUEST_TTL_SECONDS,
                payload,
            )

            message_service = MessageService()
            latest_assistant = await message_service.get_latest_assistant_message(
                UUID(chat_id)
            )
            if latest_assistant and latest_assistant.active_stream_id:
                render_payload = {
                    "request_id": request_id,
                    "tool_name": request.tool_name,
                    "tool_input": request.tool_input,
                }
                seq = await message_service.append_event_with_next_seq(
                    chat_id=UUID(chat_id),
                    message_id=latest_assistant.id,
                    stream_id=latest_assistant.active_stream_id,
                    event_type="permission_request",
                    render_payload=render_payload,
                    audit_payload={"payload": redact_for_audit(render_payload)},
                )
                envelope = build_envelope(
                    chat_id=UUID(chat_id),
                    message_id=latest_assistant.id,
                    stream_id=latest_assistant.active_stream_id,
                    seq=seq,
                    kind="permission_request",
                    payload=render_payload,
                )
                await redis.publish(
                    REDIS_KEY_CHAT_STREAM_LIVE.format(chat_id=chat_id),
                    json.dumps(envelope, ensure_ascii=False),
                )

        except Exception as exc:
            await redis.delete(request_key)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create permission request",
            ) from exc

    return PermissionRequestResponse(request_id=request_id)


@router.get(
    "/chats/{chat_id}/permissions/response/{request_id}",
    response_model=PermissionResult,
)
async def get_permission_response(
    chat_id: str,
    request_id: str,
    authorization: str = Header(...),
    timeout: int = 300,
) -> PermissionResult:
    await _validate_token_for_chat(authorization, chat_id)

    async with redis_connection() as redis:
        request_key = REDIS_KEY_PERMISSION_REQUEST.format(request_id=request_id)

        request_data = await redis.get(request_key)
        if not request_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission request not found or expired",
            )

        try:
            request_json = json.loads(request_data)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid stored permission data",
            ) from exc

        if request_json.get("chat_id") != chat_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission request does not belong to this chat",
            )

        # Refresh TTL so the request remains available while waiting.
        await redis.setex(
            request_key,
            settings.PERMISSION_REQUEST_TTL_SECONDS,
            json.dumps(request_json),
        )

        channel = REDIS_KEY_PERMISSION_RESPONSE.format(request_id=request_id)

        try:
            async with redis_pubsub(redis, channel) as pubsub:
                try:
                    async with asyncio.timeout(timeout):
                        async for message in pubsub.listen():
                            if message.get("type") != "message":
                                continue

                            try:
                                result = _parse_response_payload(message["data"])
                            except HTTPException:
                                await redis.delete(request_key)
                                raise

                            await redis.delete(request_key)
                            return result

                except asyncio.TimeoutError as exc:
                    await redis.delete(request_key)
                    raise HTTPException(
                        status_code=status.HTTP_408_REQUEST_TIMEOUT,
                        detail="Permission request timed out",
                    ) from exc
        except HTTPException:
            raise
        except Exception as exc:
            await redis.delete(request_key)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get permission response",
            ) from exc

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unexpected state: permission response not received",
    )
