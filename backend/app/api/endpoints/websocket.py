import asyncio
import errno
import json
import logging

from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.constants import (
    DEFAULT_PTY_COLS,
    DEFAULT_PTY_ROWS,
    WS_CLOSE_API_KEY_REQUIRED,
    WS_CLOSE_AUTH_FAILED,
    WS_CLOSE_SANDBOX_NOT_FOUND,
    WS_MSG_AUTH,
    WS_MSG_CLOSE,
    WS_MSG_DETACH,
    WS_MSG_INIT,
    WS_MSG_PING,
    WS_MSG_RESIZE,
)
from app.core.config import get_settings
from app.core.security import get_user_from_token
from app.db.session import SessionLocal
from sqlalchemy import select

from app.models.db_models import Chat, User
from app.services.exceptions import UserException
from app.services.sandbox_providers import (
    SandboxProviderType,
)
from app.services.terminal import terminal_session_registry
from app.services.user import UserService

settings = get_settings()
router = APIRouter()
logger = logging.getLogger(__name__)


async def authenticate_user(
    token: str,
) -> tuple[User | None, str | None, str | None, str]:
    try:
        async with SessionLocal() as db:
            user = await get_user_from_token(token, db)
            if not user:
                return None, None, None, SandboxProviderType.DOCKER.value

            user_service = UserService(session_factory=SessionLocal)
            try:
                user_settings = await user_service.get_user_settings(user.id, db=db)
                e2b_api_key = user_settings.e2b_api_key
                modal_api_key = user_settings.modal_api_key
                sandbox_provider = user_settings.sandbox_provider
            except UserException:
                e2b_api_key = None
                modal_api_key = None
                sandbox_provider = SandboxProviderType.DOCKER.value

        return user, e2b_api_key, modal_api_key, sandbox_provider

    except Exception as e:
        logger.warning("WebSocket authentication failed: %s", e)
        return None, None, None, SandboxProviderType.DOCKER.value


async def wait_for_auth(
    websocket: WebSocket, timeout: float = 10.0
) -> tuple[User | None, str | None, str | None, str]:
    try:
        message = await asyncio.wait_for(websocket.receive(), timeout=timeout)
    except asyncio.TimeoutError:
        return None, None, None, SandboxProviderType.DOCKER.value

    if "text" not in message:
        return None, None, None, SandboxProviderType.DOCKER.value

    try:
        data = json.loads(message["text"])
    except json.JSONDecodeError:
        return None, None, None, SandboxProviderType.DOCKER.value

    if data.get("type") != WS_MSG_AUTH:
        return None, None, None, SandboxProviderType.DOCKER.value

    token = data.get("token")
    if not token:
        return None, None, None, SandboxProviderType.DOCKER.value

    return await authenticate_user(token)


@router.websocket("/{sandbox_id}/terminal")
async def terminal_websocket(
    websocket: WebSocket,
    sandbox_id: str,
) -> None:
    await websocket.accept()

    user, e2b_api_key, modal_api_key, user_sandbox_provider = await wait_for_auth(
        websocket
    )
    if not user:
        await websocket.close(code=WS_CLOSE_AUTH_FAILED, reason="Authentication failed")
        return

    async with SessionLocal() as db:
        query = select(Chat.sandbox_provider).where(
            Chat.sandbox_id == sandbox_id,
            Chat.user_id == user.id,
            Chat.deleted_at.is_(None),
        )
        result = await db.execute(query)
        row = result.one_or_none()
        if not row:
            await websocket.close(
                code=WS_CLOSE_SANDBOX_NOT_FOUND, reason="Sandbox not found"
            )
            return
        sandbox_provider_type = row.sandbox_provider or user_sandbox_provider

    provider_type = SandboxProviderType(sandbox_provider_type)
    if provider_type == SandboxProviderType.E2B and not e2b_api_key:
        await websocket.close(
            code=WS_CLOSE_API_KEY_REQUIRED,
            reason="E2B API key is required. Please configure your E2B API key in Settings.",
        )
        return

    if provider_type == SandboxProviderType.MODAL and not modal_api_key:
        await websocket.close(
            code=WS_CLOSE_API_KEY_REQUIRED,
            reason="Modal API key is required. Please configure your Modal API key in Settings.",
        )
        return

    api_key = None
    if provider_type == SandboxProviderType.E2B:
        api_key = e2b_api_key
    elif provider_type == SandboxProviderType.MODAL:
        api_key = modal_api_key

    terminal_id = websocket.query_params.get("terminalId") or "terminal-1"
    session = await terminal_session_registry.get_or_create(
        user_id=str(user.id),
        sandbox_id=sandbox_id,
        terminal_id=terminal_id,
        provider_type=provider_type,
        api_key=api_key,
    )

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": WS_MSG_PING}))
                continue

            if "bytes" in message:
                session.enqueue_input(message["bytes"])
                continue

            if "text" not in message:
                continue

            try:
                data = json.loads(message["text"])
            except json.JSONDecodeError:
                continue

            data_type = data.get("type")

            if data_type == WS_MSG_INIT:
                rows = int(data.get("rows") or DEFAULT_PTY_ROWS)
                cols = int(data.get("cols") or DEFAULT_PTY_COLS)

                size = await session.ensure_started(rows, cols)
                await session.attach(websocket)

                await websocket.send_text(
                    json.dumps(
                        {
                            "type": WS_MSG_INIT,
                            "id": session.pty_id,
                            "rows": size["rows"],
                            "cols": size["cols"],
                        }
                    )
                )

            elif data_type == WS_MSG_RESIZE:
                rows = int(data.get("rows") or 0)
                cols = int(data.get("cols") or 0)
                await session.resize(rows, cols)
            elif data_type == WS_MSG_CLOSE:
                await session.kill_tmux_session()
                await session.close()
                break
            elif data_type == WS_MSG_DETACH:
                await session.detach()
                break
    except WebSocketDisconnect:
        await session.detach()
    except Exception as e:
        logger.error("Error in terminal websocket: %s", e)
    finally:
        if session.active_websocket is websocket and session.pty_id:
            await session.detach()
        try:
            await websocket.close()
        except OSError as exc:
            if exc.errno != errno.EPIPE:
                logger.error("Failed to close websocket cleanly: %s", exc)
