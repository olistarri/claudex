from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from functools import partial
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID, uuid4

from app.db.session import SessionLocal
from app.core.config import get_settings
from app.models.db_models import Chat, MessageStreamStatus, User
from app.services.claude_agent import ClaudeAgentService
from app.services.db import SessionFactoryType
from app.services.exceptions import UserException
from app.services.message import MessageService
from app.services.sandbox import SandboxService
from app.services.sandbox_providers import (
    SandboxProviderType,
    create_sandbox_provider,
)
from app.services.streaming.cancellation import CancellationHandler, StreamCancelled
from app.services.streaming.events import StreamEvent
from app.services.streaming.orchestrator import StreamContext, StreamOrchestrator
from app.services.streaming.publisher import StreamPublisher
from app.services.streaming.types import (
    ChatStreamRequest,
    ChatStreamState,
)
from app.services.streaming.session import SessionUpdateCallback
from app.services.user import UserService

logger = logging.getLogger(__name__)
settings = get_settings()


class ChatStreamRuntime:
    _background_tasks: set[asyncio.Task[str]] = set()
    _background_task_chat_ids: dict[asyncio.Task[str], str] = {}

    @classmethod
    async def stop_background_chats(cls) -> None:
        if not cls._background_tasks:
            return

        timeout = max(settings.BACKGROUND_CHAT_SHUTDOWN_TIMEOUT_SECONDS, 0.0)
        running_tasks = [task for task in cls._background_tasks if not task.done()]

        if not running_tasks:
            return

        logger.info(
            "Waiting for %s background chat task(s) to finish",
            len(running_tasks),
        )

        _, pending = await asyncio.wait(running_tasks, timeout=timeout)

        if pending:
            logger.warning(
                "Cancelled %s background chat task(s) after %.1fs shutdown timeout",
                len(pending),
                timeout,
            )
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
        cls._prune_finished_background_tasks()

    @classmethod
    def _prune_finished_background_tasks(cls) -> None:
        cls._background_tasks = {
            task for task in cls._background_tasks if not task.done()
        }
        finished_tasks = [
            task for task in list(cls._background_task_chat_ids) if task.done()
        ]
        for task in finished_tasks:
            cls._background_task_chat_ids.pop(task, None)

    @classmethod
    def has_active_chat(cls, chat_id: str) -> bool:
        if CancellationHandler.get_event(chat_id) is not None:
            return True
        cls._prune_finished_background_tasks()
        return chat_id in cls._background_task_chat_ids.values()

    @staticmethod
    def build_chat_from_data(chat_data: dict[str, str | None]) -> Chat:
        return Chat(
            id=UUID(str(chat_data["id"])),
            user_id=UUID(str(chat_data["user_id"])),
            title=str(chat_data["title"]),
            sandbox_id=chat_data.get("sandbox_id"),
            session_id=chat_data.get("session_id"),
        )

    @classmethod
    def _on_background_task_done(cls, task_id: str, task: asyncio.Task[str]) -> None:
        try:
            if task.cancelled():
                return
            try:
                error = task.exception()
            except Exception:
                logger.exception(
                    "Failed to inspect in-process chat task %s result", task_id
                )
                return
            if error:
                logger.error(
                    "In-process chat task %s failed: %s",
                    task_id,
                    error,
                    exc_info=error,
                )
        finally:
            cls._background_tasks.discard(task)
            cls._background_task_chat_ids.pop(task, None)

    @classmethod
    def start_background_chat(
        cls,
        request: ChatStreamRequest,
    ) -> str:
        resolved_task_id = str(uuid4())
        chat_id = str(request.chat_data["id"])
        background_task = asyncio.create_task(
            cls.execute_chat_with_managed_resources(
                request=request,
            )
        )
        cls._background_tasks.add(background_task)
        cls._background_task_chat_ids[background_task] = chat_id
        background_task.add_done_callback(
            partial(cls._on_background_task_done, resolved_task_id)
        )
        return resolved_task_id

    @staticmethod
    def _build_state(request: ChatStreamRequest) -> ChatStreamState:
        chat = ChatStreamRuntime.build_chat_from_data(request.chat_data)
        chat_id = str(chat.id)
        return ChatStreamState(
            chat=chat,
            chat_id=chat_id,
            chat_uuid=UUID(chat_id),
            stream_id=uuid4(),
            sandbox_id=str(chat.sandbox_id) if chat.sandbox_id else "",
            session_container={"session_id": request.session_id},
        )

    @staticmethod
    def _build_session_update_callback(
        *,
        state: ChatStreamState,
        request: ChatStreamRequest,
        session_factory: SessionFactoryType,
    ) -> SessionUpdateCallback:
        return SessionUpdateCallback(
            chat_id=state.chat_id,
            assistant_message_id=request.assistant_message_id,
            session_factory=session_factory,
            session_container=state.session_container,
        )

    @staticmethod
    def _build_stream_context(
        *,
        state: ChatStreamState,
        ai_service: ClaudeAgentService,
        stream: AsyncIterator[StreamEvent],
        sandbox_service: SandboxService,
        session_factory: SessionFactoryType,
        request: ChatStreamRequest,
    ) -> StreamContext:
        return StreamContext(
            chat_id=state.chat_id,
            chat_uuid=state.chat_uuid,
            stream=stream,
            ai_service=ai_service,
            assistant_message_id=request.assistant_message_id,
            stream_id=state.stream_id,
            sandbox_service=sandbox_service,
            chat=state.chat,
            session_factory=session_factory,
            session_container=state.session_container,
            user_id=str(state.chat.user_id),
            model_id=request.model_id,
            sandbox_id=state.sandbox_id,
        )

    @staticmethod
    def _sandbox_api_key_from_settings(user_settings: Any) -> str | None:
        provider_type = user_settings.sandbox_provider
        if provider_type == SandboxProviderType.E2B.value:
            api_key = user_settings.e2b_api_key
            return api_key if isinstance(api_key, str) else None
        if provider_type == SandboxProviderType.MODAL.value:
            api_key = user_settings.modal_api_key
            return api_key if isinstance(api_key, str) else None
        return None

    @classmethod
    async def _create_sandbox_service(
        cls,
        *,
        user_id: UUID,
        session_factory: SessionFactoryType,
    ) -> SandboxService:
        user_service = UserService(session_factory=session_factory)
        async with session_factory() as db:
            try:
                user_settings = await user_service.get_user_settings(user_id, db=db)
            except UserException:
                raise UserException("User settings not found")
            provider = create_sandbox_provider(
                provider_type=user_settings.sandbox_provider,
                api_key=cls._sandbox_api_key_from_settings(user_settings),
            )
        return SandboxService(provider=provider, session_factory=session_factory)

    @staticmethod
    async def _finalize_assistant_message_after_bootstrap_failure(
        *,
        assistant_message_id: str | None,
        session_factory: SessionFactoryType,
        stream_status: MessageStreamStatus,
    ) -> None:
        if not assistant_message_id:
            return

        try:
            message_uuid = UUID(assistant_message_id)
        except ValueError:
            return

        try:
            message_service = MessageService(session_factory=session_factory)
            message = await message_service.get_message(message_uuid)
            if not message or message.stream_status != MessageStreamStatus.IN_PROGRESS:
                return
            await message_service.update_message_snapshot(
                message_uuid,
                content_text=message.content_text or "",
                content_render=message.content_render or {"events": [], "segments": []},
                last_seq=int(message.last_seq or 0),
                active_stream_id=None,
                stream_status=stream_status,
            )
        except Exception:
            logger.exception(
                "Failed to update assistant message %s to %s after bootstrap failure",
                assistant_message_id,
                stream_status.value,
            )

    @classmethod
    async def _handle_bootstrap_failure(
        cls,
        *,
        request: ChatStreamRequest,
        session_factory: SessionFactoryType,
        stream_status: MessageStreamStatus,
    ) -> None:
        await cls._finalize_assistant_message_after_bootstrap_failure(
            assistant_message_id=request.assistant_message_id,
            session_factory=session_factory,
            stream_status=stream_status,
        )

    @classmethod
    def _start_context_usage_polling(
        cls,
        *,
        orchestrator: StreamOrchestrator,
        state: ChatStreamState,
        request: ChatStreamRequest,
        ai_service: ClaudeAgentService,
        session_factory: SessionFactoryType,
    ) -> tuple[asyncio.Task[None] | None, asyncio.Event | None]:
        if not orchestrator.publisher.redis or not state.sandbox_id:
            return None, None

        stop_event = asyncio.Event()
        poll_task = asyncio.create_task(
            cls._poll_context_usage_until_stopped(
                orchestrator=orchestrator,
                state=state,
                request=request,
                ai_service=ai_service,
                session_factory=session_factory,
                stop_event=stop_event,
            )
        )
        return poll_task, stop_event

    @staticmethod
    async def _poll_context_usage_until_stopped(
        *,
        orchestrator: StreamOrchestrator,
        state: ChatStreamState,
        request: ChatStreamRequest,
        ai_service: ClaudeAgentService,
        session_factory: SessionFactoryType,
        stop_event: asyncio.Event,
    ) -> None:
        redis_client = orchestrator.publisher.redis
        if not redis_client:
            return

        while not stop_event.is_set():
            session_id = state.session_container.get("session_id")
            if session_id:
                try:
                    await orchestrator.refresh_context_usage(
                        chat_id=state.chat_id,
                        session_id=str(session_id),
                        sandbox_id=state.sandbox_id,
                        user_id=str(state.chat.user_id),
                        model_id=request.model_id,
                        ai_service=ai_service,
                        redis_client=redis_client,
                        session_factory=session_factory,
                        assistant_message_id=request.assistant_message_id,
                        stream_id=state.stream_id,
                    )
                except Exception as exc:
                    logger.debug(
                        "Mid-stream context usage polling failed for chat %s: %s",
                        state.chat_id,
                        exc,
                    )

            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=settings.CONTEXT_USAGE_POLL_INTERVAL_SECONDS,
                )
            except asyncio.TimeoutError:
                continue

    @staticmethod
    async def _stop_context_usage_polling(
        poll_task: asyncio.Task[None] | None,
        stop_event: asyncio.Event | None,
    ) -> None:
        if stop_event:
            stop_event.set()
        if not poll_task:
            return
        poll_task.cancel()
        with suppress(asyncio.CancelledError):
            await poll_task

    @classmethod
    async def _run_stream(
        cls,
        *,
        request: ChatStreamRequest,
        state: ChatStreamState,
        sandbox_service: SandboxService,
        session_factory: SessionFactoryType,
        orchestrator: StreamOrchestrator,
    ) -> str:
        async with ClaudeAgentService(session_factory=session_factory) as ai_service:
            session_callback = cls._build_session_update_callback(
                state=state,
                request=request,
                session_factory=session_factory,
            )
            user = User(id=state.chat.user_id)
            stream = ai_service.get_ai_stream(
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                custom_instructions=request.custom_instructions,
                user=user,
                chat=state.chat,
                permission_mode=request.permission_mode,
                model_id=request.model_id,
                session_id=request.session_id,
                session_callback=session_callback,
                thinking_mode=request.thinking_mode,
                attachments=request.attachments,
                is_custom_prompt=request.is_custom_prompt,
            )
            context_usage_task, context_usage_stop_event = (
                cls._start_context_usage_polling(
                    orchestrator=orchestrator,
                    state=state,
                    request=request,
                    ai_service=ai_service,
                    session_factory=session_factory,
                )
            )
            try:
                stream_context = cls._build_stream_context(
                    state=state,
                    ai_service=ai_service,
                    stream=stream,
                    sandbox_service=sandbox_service,
                    session_factory=session_factory,
                    request=request,
                )
                try:
                    outcome = await orchestrator.process_stream(stream_context)
                except StreamCancelled:
                    return ""
                return outcome.final_content
            finally:
                await cls._stop_context_usage_polling(
                    context_usage_task,
                    context_usage_stop_event,
                )
        raise RuntimeError("Stream ended without a completion result")

    @classmethod
    async def execute_chat_stream(
        cls,
        *,
        request: ChatStreamRequest,
        sandbox_service: SandboxService,
        session_factory: SessionFactoryType,
    ) -> str:
        state = cls._build_state(request)
        publisher = StreamPublisher(state.chat_id)

        cancellation_event = CancellationHandler.register(state.chat_id)
        try:
            await publisher.connect()
            cancellation = CancellationHandler(state.chat_id, event=cancellation_event)
            orchestrator = StreamOrchestrator(
                publisher,
                cancellation,
                start_background_chat=cls.start_background_chat,
            )
            return await cls._run_stream(
                request=request,
                state=state,
                sandbox_service=sandbox_service,
                session_factory=session_factory,
                orchestrator=orchestrator,
            )
        except asyncio.CancelledError:
            await cls._handle_bootstrap_failure(
                request=request,
                session_factory=session_factory,
                stream_status=MessageStreamStatus.INTERRUPTED,
            )
            raise
        finally:
            CancellationHandler.unregister(state.chat_id, cancellation_event)
            await publisher.cleanup()

    @classmethod
    async def execute_chat_with_managed_resources(
        cls,
        *,
        request: ChatStreamRequest,
    ) -> str:
        session_factory = SessionLocal
        try:
            sandbox_service = await cls._create_sandbox_service(
                user_id=UUID(str(request.chat_data["user_id"])),
                session_factory=session_factory,
            )
        except asyncio.CancelledError:
            await cls._handle_bootstrap_failure(
                request=request,
                session_factory=session_factory,
                stream_status=MessageStreamStatus.INTERRUPTED,
            )
            raise
        except Exception:
            await cls._handle_bootstrap_failure(
                request=request,
                session_factory=session_factory,
                stream_status=MessageStreamStatus.FAILED,
            )
            raise
        try:
            return await cls.execute_chat_stream(
                request=request,
                sandbox_service=sandbox_service,
                session_factory=session_factory,
            )
        finally:
            await sandbox_service.cleanup()
