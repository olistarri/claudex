from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from contextlib import suppress
from functools import partial
from typing import Any
from uuid import UUID, uuid4

from redis.asyncio import Redis
from sqlalchemy import select

from app.constants import REDIS_KEY_CHAT_CONTEXT_USAGE, REDIS_KEY_CHAT_STREAM_LIVE
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.db_models import Chat, Message, MessageRole, MessageStreamStatus, User
from app.prompts.system_prompt import build_system_prompt_for_chat
from app.services.claude_agent import ClaudeAgentService
from app.services.db import SessionFactoryType
from app.services.exceptions import ClaudeAgentException
from app.services.message import MessageService
from app.services.queue import QueueService
from app.services.sandbox import SandboxService
from app.services.streaming.cancellation import CancellationHandler, StreamCancelled
from app.services.streaming.events import StreamEvent
from app.services.streaming.protocol import StreamEnvelope, StreamSnapshotAccumulator
from app.services.streaming.session import SessionUpdateCallback
from app.services.streaming.types import ChatStreamRequest
from app.services.user import UserService
from app.utils.redis import redis_connection

logger = logging.getLogger(__name__)
settings = get_settings()


class ChatStreamRuntime:
    _background_tasks: set[asyncio.Task[str]] = set()
    _background_task_chat_ids: dict[asyncio.Task[str], str] = {}

    def __init__(
        self,
        *,
        chat: Chat,
        stream_id: UUID,
        sandbox_id: str,
        session_container: dict[str, Any],
        assistant_message_id: str | None,
        user_id: str,
        model_id: str,
        sandbox_service: SandboxService,
        session_factory: SessionFactoryType,
    ) -> None:
        self.chat = chat
        self.chat_id = str(chat.id)
        self.stream_id = stream_id
        self.sandbox_id = sandbox_id
        self.session_container = session_container
        self.assistant_message_id = assistant_message_id
        self.user_id = user_id
        self.model_id = model_id
        self.sandbox_service = sandbox_service
        self.session_factory = session_factory

        self.event_count: int = 0
        self.snapshot = StreamSnapshotAccumulator()
        self.last_seq: int = 0
        self.pending_since_flush: int = 0
        self.last_flush_at: float = time.monotonic()
        self.message_service = MessageService(session_factory=session_factory)
        self._event_buffer: list[tuple[str, dict[str, Any], dict[str, Any] | None]] = []

        self._redis: Redis[str] | None = None
        self.cancellation: CancellationHandler | None = None

    async def _connect_redis(self) -> None:
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

    async def _close_redis(self) -> None:
        if not self._redis:
            return
        try:
            await self._redis.close()
        except Exception as exc:
            logger.debug("Error closing Redis client: %s", exc)
        self._redis = None

    async def run(
        self, ai_service: ClaudeAgentService, stream: AsyncIterator[StreamEvent]
    ) -> str:
        try:
            start_seq = await self._emit_event(
                "stream_started",
                {"status": "started"},
                apply_snapshot=False,
            )
            if self.assistant_message_id:
                message_service = self.message_service
                await message_service.update_message_snapshot(
                    UUID(self.assistant_message_id),
                    content_text="",
                    content_render=self.snapshot.to_render(),
                    last_seq=start_seq,
                    active_stream_id=self.stream_id,
                )
            await self._consume_stream(ai_service, stream)

            if self.cancellation and self.cancellation.was_cancelled:
                if not self.cancellation.cancel_requested:
                    await ai_service.cancel_active_stream()
                final_content = await self._complete_stream(
                    ai_service, MessageStreamStatus.INTERRUPTED
                )
                raise StreamCancelled(final_content)

            if self.event_count == 0:
                raise ClaudeAgentException("Stream completed without any events")

            final_content = await self._complete_stream(
                ai_service, MessageStreamStatus.COMPLETED
            )
            return final_content

        except StreamCancelled:
            raise
        except Exception as exc:
            logger.error("Error in stream processing: %s", exc)
            await self._emit_event(
                "error",
                {"error": str(exc)},
                apply_snapshot=False,
            )
            await self._save_final_snapshot(ai_service, MessageStreamStatus.FAILED)
            raise

    async def _consume_stream(
        self,
        ai_service: ClaudeAgentService,
        stream: AsyncIterator[StreamEvent],
    ) -> None:
        stream_iter = stream.__aiter__()
        current_task = asyncio.current_task()
        revocation_task = (
            self.cancellation.create_monitor_task(current_task, ai_service)
            if self.cancellation
            else None
        )

        try:
            while True:
                try:
                    event = await stream_iter.__anext__()
                except StopAsyncIteration:
                    break
                except asyncio.CancelledError:
                    if self.cancellation and self.cancellation.was_cancelled:
                        await self.cancellation.cancel_stream(ai_service)
                        break
                    raise

                self.event_count += 1
                kind = str(event.get("type") or "system")
                payload = {k: v for k, v in event.items() if k != "type"}
                await self._emit_event(kind, payload)
                await self._flush_snapshot(force=False)
        finally:
            if revocation_task:
                revocation_task.cancel()
                with suppress(asyncio.CancelledError):
                    await revocation_task

    _SNAPSHOT_EVENT_KINDS = frozenset(
        {
            "assistant_text",
            "assistant_thinking",
            "tool_started",
            "tool_completed",
            "tool_failed",
            "prompt_suggestions",
            "system",
            "permission_request",
        }
    )

    async def _emit_event(
        self,
        kind: str,
        payload: dict[str, Any],
        *,
        apply_snapshot: bool = True,
    ) -> int:
        if not self.assistant_message_id:
            return 0

        audit = {"payload": StreamEnvelope.sanitize_payload(payload)}
        if apply_snapshot and kind in self._SNAPSHOT_EVENT_KINDS:
            self._event_buffer.append((kind, payload, audit))
            self.snapshot.add_event(kind, payload)
            self.pending_since_flush += 1
            return 0

        await self._flush_event_buffer()
        seq = await self.message_service.append_event_with_next_seq(
            chat_id=self.chat.id,
            message_id=UUID(self.assistant_message_id),
            stream_id=self.stream_id,
            event_type=kind,
            render_payload=payload,
            audit_payload=audit,
        )
        self.last_seq = seq
        await self._signal_redis()
        return seq

    async def _flush_event_buffer(self) -> None:
        if not self._event_buffer or not self.assistant_message_id:
            return
        batch = self._event_buffer
        seq = await self.message_service.append_events_batch(
            chat_id=self.chat.id,
            message_id=UUID(self.assistant_message_id),
            stream_id=self.stream_id,
            events=batch,
        )
        self._event_buffer = []
        self.last_seq = seq

    async def _signal_redis(self) -> None:
        if not self._redis:
            return
        try:
            await self._redis.publish(
                REDIS_KEY_CHAT_STREAM_LIVE.format(chat_id=self.chat_id),
                "flush",
            )
        except Exception as exc:
            logger.warning(
                "Failed to publish Redis signal for chat %s: %s",
                self.chat_id,
                exc,
            )

    async def _flush_snapshot(self, *, force: bool) -> None:
        if not self.assistant_message_id:
            return
        if not force:
            elapsed_ms = (time.monotonic() - self.last_flush_at) * 1000
            if self.pending_since_flush == 0:
                return
            if elapsed_ms < 200 and self.pending_since_flush < 24:
                return

        await self._flush_event_buffer()
        await self.message_service.update_message_snapshot(
            UUID(self.assistant_message_id),
            content_text=self.snapshot.content_text,
            content_render=self.snapshot.to_render(),
            last_seq=self.last_seq,
            active_stream_id=self.stream_id,
        )
        await self._signal_redis()
        self.pending_since_flush = 0
        self.last_flush_at = time.monotonic()

    async def _save_final_snapshot(
        self,
        ai_service: ClaudeAgentService,
        stream_status: MessageStreamStatus,
    ) -> None:
        if not self.assistant_message_id:
            return
        await self._flush_event_buffer()
        await self.message_service.update_message_snapshot(
            UUID(self.assistant_message_id),
            content_text=self.snapshot.content_text,
            content_render=self.snapshot.to_render(),
            last_seq=self.last_seq,
            active_stream_id=None,
            stream_status=stream_status,
            total_cost_usd=ai_service.get_total_cost_usd(),
        )

    async def _complete_stream(
        self,
        ai_service: ClaudeAgentService,
        status: MessageStreamStatus,
    ) -> str:
        await self._save_final_snapshot(ai_service, status)
        final_content = self.snapshot.content_text

        if status == MessageStreamStatus.COMPLETED:
            await self._try_create_checkpoint()
            queue_processed = await self._try_process_next_queued()
            if not queue_processed:
                await self._emit_final_context_usage(ai_service)
                await self._emit_event(
                    "complete",
                    {"status": "completed"},
                    apply_snapshot=False,
                )
        else:
            await self._emit_final_context_usage(ai_service)
            terminal_kind = (
                "cancelled" if status == MessageStreamStatus.INTERRUPTED else "complete"
            )
            await self._emit_event(
                terminal_kind,
                {"status": status.value},
                apply_snapshot=False,
            )

        return final_content

    async def _try_create_checkpoint(self) -> None:
        if not (
            self.sandbox_service and self.chat.sandbox_id and self.assistant_message_id
        ):
            return

        try:
            checkpoint_id = await self.sandbox_service.create_checkpoint(
                self.chat.sandbox_id, self.assistant_message_id
            )
            if not checkpoint_id:
                return

            async with self.session_factory() as db:
                message_uuid = UUID(self.assistant_message_id)
                query = select(Message).filter(Message.id == message_uuid)
                result = await db.execute(query)
                message = result.scalar_one_or_none()
                if message:
                    message.checkpoint_id = checkpoint_id
                    db.add(message)
                    await db.commit()
        except Exception as exc:
            logger.warning("Failed to create checkpoint: %s", exc)

    async def _try_process_next_queued(self) -> bool:
        try:
            async with redis_connection() as redis:
                queue_service = QueueService(redis)
                next_msg = await queue_service.pop_next_message(self.chat_id)
            if not next_msg:
                return False

            message_service = self.message_service
            user_message = await message_service.create_message(
                UUID(self.chat_id),
                next_msg["content"],
                MessageRole.USER,
                attachments=next_msg.get("attachments"),
            )
            assistant_message = await message_service.create_message(
                UUID(self.chat_id),
                "",
                MessageRole.ASSISTANT,
                model_id=next_msg["model_id"],
                stream_status=MessageStreamStatus.IN_PROGRESS,
            )

            await self._emit_event(
                "queue_processing",
                {
                    "queued_message_id": next_msg["id"],
                    "user_message_id": str(user_message.id),
                    "assistant_message_id": str(assistant_message.id),
                    "content": next_msg["content"],
                    "model_id": next_msg["model_id"],
                    "attachments": MessageService.serialize_attachments(
                        next_msg, user_message
                    ),
                },
                apply_snapshot=False,
            )

            user_service = UserService(session_factory=self.session_factory)
            user_settings = await user_service.get_user_settings(
                self.chat.user_id, db=None
            )

            system_prompt = build_system_prompt_for_chat(
                self.chat.sandbox_id or "",
                user_settings,
            )

            ChatStreamRuntime.start_background_chat(
                ChatStreamRequest(
                    prompt=next_msg["content"],
                    system_prompt=system_prompt,
                    custom_instructions=(
                        user_settings.custom_instructions if user_settings else None
                    ),
                    chat_data={
                        "id": self.chat_id,
                        "user_id": str(self.chat.user_id),
                        "title": self.chat.title,
                        "sandbox_id": self.chat.sandbox_id,
                        "session_id": self.chat.session_id,
                    },
                    permission_mode=next_msg.get("permission_mode", "auto"),
                    model_id=next_msg["model_id"],
                    session_id=self.chat.session_id,
                    assistant_message_id=str(assistant_message.id),
                    thinking_mode=next_msg.get("thinking_mode"),
                    attachments=next_msg.get("attachments"),
                    is_custom_prompt=False,
                )
            )

            logger.info(
                "Queued message %s for chat %s has been processed",
                next_msg["id"],
                self.chat_id,
            )
            return True

        except Exception as exc:
            logger.error("Failed to process queued message: %s", exc)
            return False

    async def _emit_final_context_usage(self, ai_service: ClaudeAgentService) -> None:
        session_id = (
            self.session_container.get("session_id")
            if self.session_container
            else self.chat.session_id
        )
        if (
            not session_id
            or not self.sandbox_id
            or not self.user_id
            or not self.model_id
            or not self._redis
        ):
            return

        await self._refresh_context_usage(
            ai_service=ai_service,
            session_id=str(session_id),
        )

    async def _refresh_context_usage(
        self,
        *,
        ai_service: ClaudeAgentService,
        session_id: str,
    ) -> dict[str, Any] | None:
        redis_client = self._redis
        if not redis_client:
            return None
        try:
            user_settings = await UserService(
                session_factory=self.session_factory
            ).get_user_settings(UUID(self.user_id))
            token_usage = await ai_service.get_context_token_usage(
                session_id=session_id,
                sandbox_id=self.sandbox_id,
                model_id=self.model_id,
                user_settings=user_settings,
            )
            if token_usage is None:
                return None

            context_window = settings.CONTEXT_WINDOW_TOKENS
            percentage = (
                min((token_usage / context_window) * 100, 100.0)
                if context_window > 0
                else 0.0
            )
            context_data: dict[str, Any] = {
                "tokens_used": token_usage,
                "context_window": context_window,
                "percentage": percentage,
            }

            async with self.session_factory() as db:
                result = await db.execute(select(Chat).filter(Chat.id == self.chat.id))
                chat = result.scalar_one_or_none()
                if chat:
                    chat.context_token_usage = token_usage
                    db.add(chat)
                    await db.commit()

            await redis_client.setex(
                REDIS_KEY_CHAT_CONTEXT_USAGE.format(chat_id=self.chat_id),
                settings.CONTEXT_USAGE_CACHE_TTL_SECONDS,
                json.dumps(context_data),
            )

            await self._emit_context_usage_event(context_data)
            return context_data
        except Exception as exc:
            logger.debug(
                "Context usage refresh failed for chat %s: %s", self.chat_id, exc
            )
            return None

    async def _emit_context_usage_event(
        self,
        context_data: dict[str, Any],
    ) -> None:
        if not self.assistant_message_id:
            return
        payload: dict[str, Any] = {
            "context_usage": context_data,
            "chat_id": self.chat_id,
        }
        await self._emit_event("system", payload, apply_snapshot=False)

    def _start_context_usage_polling(
        self,
        ai_service: ClaudeAgentService,
    ) -> tuple[asyncio.Task[None] | None, asyncio.Event | None]:
        if not self._redis or not self.sandbox_id:
            return None, None

        stop_event = asyncio.Event()
        poll_task = asyncio.create_task(
            self._poll_context_usage(ai_service, stop_event)
        )
        return poll_task, stop_event

    async def _poll_context_usage(
        self,
        ai_service: ClaudeAgentService,
        stop_event: asyncio.Event,
    ) -> None:
        if not self._redis:
            return

        while not stop_event.is_set():
            session_id = self.session_container.get("session_id")
            if session_id:
                try:
                    await self._refresh_context_usage(
                        ai_service=ai_service,
                        session_id=str(session_id),
                    )
                except Exception as exc:
                    logger.debug(
                        "Mid-stream context usage polling failed for chat %s: %s",
                        self.chat_id,
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
        cls._prune_done_tasks()

    @classmethod
    def _prune_done_tasks(cls) -> None:
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
        cls._prune_done_tasks()
        return chat_id in cls._background_task_chat_ids.values()

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
            cls.execute_chat(
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
    def _build_instance(
        request: ChatStreamRequest,
        sandbox_service: SandboxService,
        session_factory: SessionFactoryType,
    ) -> ChatStreamRuntime:
        chat = Chat.from_dict(request.chat_data)
        return ChatStreamRuntime(
            chat=chat,
            stream_id=uuid4(),
            sandbox_id=str(chat.sandbox_id) if chat.sandbox_id else "",
            session_container={"session_id": request.session_id},
            assistant_message_id=request.assistant_message_id,
            user_id=str(chat.user_id),
            model_id=request.model_id,
            sandbox_service=sandbox_service,
            session_factory=session_factory,
        )

    @staticmethod
    async def _mark_message_failed(
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
                content_render=message.content_render or {"events": []},
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
        await cls._mark_message_failed(
            assistant_message_id=request.assistant_message_id,
            session_factory=session_factory,
            stream_status=stream_status,
        )

    @classmethod
    async def _run_stream(
        cls,
        *,
        request: ChatStreamRequest,
        instance: ChatStreamRuntime,
    ) -> str:
        async with ClaudeAgentService(
            session_factory=instance.session_factory
        ) as ai_service:
            session_callback = SessionUpdateCallback(
                chat_id=instance.chat_id,
                assistant_message_id=request.assistant_message_id,
                session_factory=instance.session_factory,
                session_container=instance.session_container,
            )
            user = User(id=instance.chat.user_id)
            stream = ai_service.get_ai_stream(
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                custom_instructions=request.custom_instructions,
                user=user,
                chat=instance.chat,
                permission_mode=request.permission_mode,
                model_id=request.model_id,
                session_id=request.session_id,
                session_callback=session_callback,
                thinking_mode=request.thinking_mode,
                attachments=request.attachments,
                is_custom_prompt=request.is_custom_prompt,
            )
            context_usage_task, context_usage_stop_event = (
                instance._start_context_usage_polling(ai_service)
            )
            try:
                try:
                    return await instance.run(ai_service, stream)
                except StreamCancelled:
                    return ""
            finally:
                await cls._stop_context_usage_polling(
                    context_usage_task,
                    context_usage_stop_event,
                )

    @classmethod
    async def execute_chat_stream(
        cls,
        *,
        request: ChatStreamRequest,
        sandbox_service: SandboxService,
        session_factory: SessionFactoryType,
    ) -> str:
        instance = cls._build_instance(request, sandbox_service, session_factory)

        cancellation_event = CancellationHandler.register(instance.chat_id)
        try:
            await instance._connect_redis()
            instance.cancellation = CancellationHandler(
                instance.chat_id, event=cancellation_event
            )
            return await cls._run_stream(
                request=request,
                instance=instance,
            )
        except asyncio.CancelledError:
            await cls._handle_bootstrap_failure(
                request=request,
                session_factory=session_factory,
                stream_status=MessageStreamStatus.INTERRUPTED,
            )
            raise
        finally:
            CancellationHandler.unregister(instance.chat_id, cancellation_event)
            await instance._close_redis()

    @classmethod
    async def execute_chat(
        cls,
        *,
        request: ChatStreamRequest,
    ) -> str:
        session_factory = SessionLocal
        try:
            sandbox_service = await SandboxService.create_for_user(
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
