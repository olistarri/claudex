import logging

from celery import Celery

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "claudex",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.chat",
        "app.tasks.scheduler",
        "app.tasks.cleanup",
    ],
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
    "cleanup-orphaned-sandboxes-hourly": {
        "task": "cleanup_orphaned_sandboxes",
        "schedule": 3600.0,
    },
}
