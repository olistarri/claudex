import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Response, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.docs import custom_openapi
from app.api.endpoints import (
    ai_model,
    auth,
    chat,
    sandbox,
    websocket,
    attachments,
    permissions,
    scheduler,
    skills,
    commands,
    agents,
    mcps,
    marketplace,
    integrations,
)
from app.api.endpoints import settings as settings_router
from app.core.config import get_settings
from app.core.middleware import (
    setup_middleware,
)
from app.db.session import engine, SessionLocal
from app.services.maintenance import MaintenanceService
from app.services.streaming.runtime import ChatStreamRuntime
from app.utils.redis import redis_connection
from app.admin.config import create_admin
from app.admin.views import (
    UserAdmin,
    ChatAdmin,
    MessageAdmin,
    MessageAttachmentAdmin,
    UserSettingsAdmin,
)
from prometheus_fastapi_instrumentator import Instrumentator

from granian.utils.proxies import wrap_asgi_with_proxy_headers

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    maintenance_service = MaintenanceService()
    await maintenance_service.start()
    try:
        yield
    finally:
        await maintenance_service.stop()
        await ChatStreamRuntime.stop_background_chats()
        await engine.dispose()


async def _check_database_ready() -> tuple[bool, str | None]:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:
        logger.warning("Readiness database check failed: %s", exc)
        return False, str(exc)


async def _check_redis_ready() -> tuple[bool, str | None]:
    try:
        async with redis_connection() as redis:
            pong = await redis.ping()
        if pong:
            return True, None
        return False, "Redis ping returned false"
    except Exception as exc:
        logger.warning("Readiness Redis check failed: %s", exc)
        return False, str(exc)


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url=None
        if settings.ENVIRONMENT == "production"
        else f"{settings.API_V1_STR}/docs",
        openapi_url=None
        if settings.ENVIRONMENT == "production"
        else f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan,
    )

    try:
        application.mount("/static", StaticFiles(directory="static"), name="static")
    except Exception as e:
        logger.debug("Static files directory not found, skipping mount: %s", e)

    try:
        storage_path = Path(settings.STORAGE_PATH)
        storage_path.mkdir(exist_ok=True)
    except Exception as e:
        logger.warning(
            "Failed to create storage directory at %s: %s", settings.STORAGE_PATH, e
        )

    setup_middleware(application)

    application.include_router(
        auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"]
    )
    application.include_router(
        chat.router, prefix=f"{settings.API_V1_STR}/chat", tags=["Chat"]
    )
    application.include_router(
        sandbox.router, prefix=f"{settings.API_V1_STR}/sandbox", tags=["Sandbox"]
    )
    application.include_router(
        websocket.router, prefix=f"{settings.API_V1_STR}/ws", tags=["WebSocket"]
    )
    application.include_router(
        settings_router.router,
        prefix=f"{settings.API_V1_STR}/settings",
        tags=["Settings"],
    )
    application.include_router(
        skills.router,
        prefix=f"{settings.API_V1_STR}/skills",
        tags=["Skills"],
    )
    application.include_router(
        commands.router,
        prefix=f"{settings.API_V1_STR}/commands",
        tags=["Commands"],
    )
    application.include_router(
        agents.router,
        prefix=f"{settings.API_V1_STR}/agents",
        tags=["Agents"],
    )
    application.include_router(
        mcps.router,
        prefix=f"{settings.API_V1_STR}/mcps",
        tags=["MCPs"],
    )
    application.include_router(
        attachments.router,
        prefix=f"{settings.API_V1_STR}",
        tags=["Attachments"],
    )
    application.include_router(
        permissions.router,
        prefix=f"{settings.API_V1_STR}",
        tags=["Permissions"],
    )
    application.include_router(
        scheduler.router,
        prefix=f"{settings.API_V1_STR}/scheduler",
        tags=["Scheduler"],
    )
    application.include_router(
        ai_model.router,
        prefix=f"{settings.API_V1_STR}/models",
        tags=["Models"],
    )
    application.include_router(
        marketplace.router,
        prefix=f"{settings.API_V1_STR}/marketplace",
        tags=["Marketplace"],
    )
    application.include_router(
        integrations.router,
        prefix=f"{settings.API_V1_STR}/integrations",
        tags=["Integrations"],
    )
    application.openapi = lambda: custom_openapi(application)

    admin = create_admin(application, engine, SessionLocal)

    admin.add_view(UserAdmin)
    admin.add_view(ChatAdmin)
    admin.add_view(MessageAdmin)
    admin.add_view(MessageAttachmentAdmin)
    admin.add_view(UserSettingsAdmin)

    @application.get("/health")
    async def health_check() -> dict[str, str]:
        return {"status": "healthy"}

    @application.get(f"{settings.API_V1_STR}/readyz")
    async def readyz(response: Response) -> dict[str, Any]:
        db_ok, db_error = await _check_database_ready()
        redis_ok, redis_error = await _check_redis_ready()

        checks: dict[str, dict[str, str | bool]] = {
            "database": {"ok": db_ok},
            "redis": {"ok": redis_ok},
        }
        if db_error:
            checks["database"]["error"] = db_error
        if redis_error:
            checks["redis"]["error"] = redis_error

        if db_ok and redis_ok:
            return {"status": "ready", "checks": checks}

        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "checks": checks}

    return application


app = create_application()
Instrumentator().instrument(app).expose(app)

if not settings.DISABLE_PROXY_HEADERS:
    app = wrap_asgi_with_proxy_headers(app, trusted_hosts=settings.TRUSTED_PROXY_HOSTS)
