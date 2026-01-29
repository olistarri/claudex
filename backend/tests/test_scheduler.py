from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.models.db_models import User


class TestCreateScheduledTask:
    async def test_create_scheduled_task(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        response = await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "Test Task",
                "prompt_message": "Run daily health check",
                "recurrence_type": "daily",
                "scheduled_time": "09:00",
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["task_name"] == "Test Task"
        assert data["prompt_message"] == "Run daily health check"
        assert data["recurrence_type"] == "daily"
        assert data["scheduled_time"] == "09:00"
        assert data["status"] == "active"
        assert "id" in data
        assert uuid.UUID(data["id"])

    async def test_create_task_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        response = await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "Test Task",
                "prompt_message": "Run test",
                "recurrence_type": "daily",
                "scheduled_time": "09:00",
            },
        )

        assert response.status_code == 401


class TestListScheduledTasks:
    async def test_list_tasks_empty(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        response = await async_client.get(
            "/api/v1/scheduler/tasks",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_tasks_after_creating(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "List Test Task",
                "prompt_message": "Test prompt",
                "recurrence_type": "once",
                "scheduled_time": "12:00",
            },
            headers=auth_headers,
        )

        response = await async_client.get(
            "/api/v1/scheduler/tasks",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


class TestGetScheduledTask:
    async def test_get_task(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        create_response = await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "Get Test Task",
                "prompt_message": "Test prompt",
                "recurrence_type": "weekly",
                "scheduled_time": "15:00",
                "scheduled_day": 1,
            },
            headers=auth_headers,
        )
        task_id = create_response.json()["id"]

        response = await async_client.get(
            f"/api/v1/scheduler/tasks/{task_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == task_id
        assert data["task_name"] == "Get Test Task"

    async def test_get_task_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.get(
            f"/api/v1/scheduler/tasks/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestDeleteScheduledTask:
    async def test_delete_task(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        create_response = await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "Delete Test Task",
                "prompt_message": "Test prompt",
                "recurrence_type": "monthly",
                "scheduled_time": "18:00",
                "scheduled_day": 15,
            },
            headers=auth_headers,
        )
        task_id = create_response.json()["id"]

        response = await async_client.delete(
            f"/api/v1/scheduler/tasks/{task_id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

        get_response = await async_client.get(
            f"/api/v1/scheduler/tasks/{task_id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404


class TestToggleScheduledTask:
    async def test_toggle_task(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        create_response = await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "Toggle Test Task",
                "prompt_message": "Test prompt",
                "recurrence_type": "daily",
                "scheduled_time": "21:00",
            },
            headers=auth_headers,
        )
        task_id = create_response.json()["id"]
        initial_status = create_response.json()["status"]
        assert initial_status == "active"

        response = await async_client.post(
            f"/api/v1/scheduler/tasks/{task_id}/toggle",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False

    async def test_toggle_task_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.post(
            f"/api/v1/scheduler/tasks/{fake_id}/toggle",
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_toggle_task_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.post(
            f"/api/v1/scheduler/tasks/{fake_id}/toggle",
        )

        assert response.status_code == 401


class TestUpdateScheduledTask:
    async def test_update_task(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        create_response = await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "Update Test Task",
                "prompt_message": "Original prompt",
                "recurrence_type": "daily",
                "scheduled_time": "10:00",
            },
            headers=auth_headers,
        )
        task_id = create_response.json()["id"]

        response = await async_client.put(
            f"/api/v1/scheduler/tasks/{task_id}",
            json={
                "task_name": "Updated Task Name",
                "prompt_message": "Updated prompt",
                "recurrence_type": "weekly",
                "scheduled_time": "14:00",
                "scheduled_day": 2,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["task_name"] == "Updated Task Name"
        assert data["prompt_message"] == "Updated prompt"
        assert data["recurrence_type"] == "weekly"

    async def test_update_task_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.put(
            f"/api/v1/scheduler/tasks/{fake_id}",
            json={
                "task_name": "Test",
                "prompt_message": "Test",
                "recurrence_type": "daily",
                "scheduled_time": "10:00",
            },
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_update_task_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.put(
            f"/api/v1/scheduler/tasks/{fake_id}",
            json={"task_name": "Test"},
        )

        assert response.status_code == 401


class TestTaskHistory:
    async def test_get_task_history(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        create_response = await async_client.post(
            "/api/v1/scheduler/tasks",
            json={
                "task_name": "History Test Task",
                "prompt_message": "Test prompt",
                "recurrence_type": "daily",
                "scheduled_time": "11:00",
            },
            headers=auth_headers,
        )
        task_id = create_response.json()["id"]

        response = await async_client.get(
            f"/api/v1/scheduler/tasks/{task_id}/history",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    async def test_get_task_history_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.get(
            f"/api/v1/scheduler/tasks/{fake_id}/history",
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_get_task_history_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.get(
            f"/api/v1/scheduler/tasks/{fake_id}/history",
        )

        assert response.status_code == 401


class TestSchedulerUnauthorized:
    @pytest.mark.parametrize(
        "method,endpoint",
        [
            ("GET", "/api/v1/scheduler/tasks"),
            ("DELETE", "/api/v1/scheduler/tasks/{task_id}"),
            ("GET", "/api/v1/scheduler/tasks/{task_id}"),
        ],
    )
    async def test_scheduler_endpoints_unauthorized(
        self,
        async_client: AsyncClient,
        method: str,
        endpoint: str,
    ) -> None:
        fake_id = str(uuid.uuid4())
        endpoint = endpoint.format(task_id=fake_id)

        if method == "GET":
            response = await async_client.get(endpoint)
        elif method == "DELETE":
            response = await async_client.delete(endpoint)
        else:
            response = await async_client.request(method, endpoint)

        assert response.status_code == 401


class TestSchedulerNotFound:
    async def test_delete_task_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.delete(
            f"/api/v1/scheduler/tasks/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
