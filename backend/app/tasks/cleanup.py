import asyncio
from typing import Any

from app.core.celery import celery_app
from app.services.refresh_token import RefreshTokenService
from app.services.sandbox import SandboxService


@celery_app.task(name="cleanup_expired_refresh_tokens")
def cleanup_expired_refresh_tokens() -> dict[str, Any]:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(RefreshTokenService.cleanup_expired_tokens_job())
    finally:
        loop.close()


@celery_app.task(name="cleanup_orphaned_sandboxes")
def cleanup_orphaned_sandboxes_task() -> dict[str, Any]:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(SandboxService.cleanup_orphaned_sandboxes())
    finally:
        loop.close()
