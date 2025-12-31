from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.models.db_models import Chat, User
from app.services.sandbox import SandboxService
from tests.conftest import STREAMING_TEST_TIMEOUT


class TestCreateChat:
    async def test_create_chat(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
        seed_ai_models: None,
    ) -> None:
        response = await async_client.post(
            "/api/v1/chat/chats",
            json={"title": "Test Chat", "model_id": "claude-haiku-4-5"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Chat"
        assert "id" in data
        assert uuid.UUID(data["id"])
        assert data["user_id"] == str(integration_user_fixture.id)
        assert "sandbox_id" in data
        assert "created_at" in data

    async def test_create_chat_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        response = await async_client.post(
            "/api/v1/chat/chats",
            json={"title": "Test", "model_id": "claude-haiku-4-5"},
        )

        assert response.status_code == 401


class TestGetChats:
    async def test_get_chats(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        response = await async_client.get(
            "/api/v1/chat/chats",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert isinstance(data["items"], list)
        assert data["total"] >= 1

    async def test_get_chats_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        response = await async_client.get("/api/v1/chat/chats")

        assert response.status_code == 401


class TestGetChatDetail:
    async def test_get_chat_detail(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture

        response = await async_client.get(
            f"/api/v1/chat/chats/{chat.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(chat.id)
        assert data["title"] == chat.title
        assert "sandbox_id" in data
        assert "created_at" in data

    async def test_get_chat_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.get(
            f"/api/v1/chat/chats/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestUpdateChat:
    async def test_update_chat(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture
        new_title = "Updated Chat Title"

        response = await async_client.patch(
            f"/api/v1/chat/chats/{chat.id}",
            json={"title": new_title},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == new_title
        assert data["id"] == str(chat.id)

    async def test_update_chat_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.patch(
            f"/api/v1/chat/chats/{fake_id}",
            json={"title": "New Title"},
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestPinChat:
    async def test_pin_chat(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture

        response = await async_client.patch(
            f"/api/v1/chat/chats/{chat.id}",
            json={"pinned": True},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(chat.id)
        assert data["pinned_at"] is not None

    async def test_unpin_chat(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture

        await async_client.patch(
            f"/api/v1/chat/chats/{chat.id}",
            json={"pinned": True},
            headers=auth_headers,
        )

        response = await async_client.patch(
            f"/api/v1/chat/chats/{chat.id}",
            json={"pinned": False},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(chat.id)
        assert data["pinned_at"] is None

    async def test_pinned_chats_appear_first(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
        seed_ai_models: None,
    ) -> None:
        chat1_response = await async_client.post(
            "/api/v1/chat/chats",
            json={"title": "Chat 1", "model_id": "claude-haiku-4-5"},
            headers=auth_headers,
        )
        chat1_id = chat1_response.json()["id"]

        await async_client.post(
            "/api/v1/chat/chats",
            json={"title": "Chat 2", "model_id": "claude-haiku-4-5"},
            headers=auth_headers,
        )

        await async_client.patch(
            f"/api/v1/chat/chats/{chat1_id}",
            json={"pinned": True},
            headers=auth_headers,
        )

        list_response = await async_client.get(
            "/api/v1/chat/chats",
            headers=auth_headers,
        )

        assert list_response.status_code == 200
        items = list_response.json()["items"]

        pinned_indices = [i for i, c in enumerate(items) if c.get("pinned_at")]
        unpinned_indices = [i for i, c in enumerate(items) if not c.get("pinned_at")]

        if pinned_indices and unpinned_indices:
            assert max(pinned_indices) < min(unpinned_indices)

    async def test_pin_chat_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.patch(
            f"/api/v1/chat/chats/{fake_id}",
            json={"pinned": True},
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestDeleteChat:
    async def test_delete_chat(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
        seed_ai_models: None,
    ) -> None:
        create_response = await async_client.post(
            "/api/v1/chat/chats",
            json={"title": "Chat to Delete", "model_id": "claude-haiku-4-5"},
            headers=auth_headers,
        )
        chat_id = create_response.json()["id"]

        response = await async_client.delete(
            f"/api/v1/chat/chats/{chat_id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

        get_response = await async_client.get(
            f"/api/v1/chat/chats/{chat_id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404


class TestDeleteAllChats:
    async def test_delete_all_chats(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
        seed_ai_models: None,
    ) -> None:
        await async_client.post(
            "/api/v1/chat/chats",
            json={"title": "Chat 1", "model_id": "claude-haiku-4-5"},
            headers=auth_headers,
        )
        await async_client.post(
            "/api/v1/chat/chats",
            json={"title": "Chat 2", "model_id": "claude-haiku-4-5"},
            headers=auth_headers,
        )

        response = await async_client.delete(
            "/api/v1/chat/chats/all",
            headers=auth_headers,
        )

        assert response.status_code == 204

        list_response = await async_client.get(
            "/api/v1/chat/chats",
            headers=auth_headers,
        )
        assert list_response.json()["total"] == 0


class TestGetMessages:
    async def test_get_messages(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture

        response = await async_client.get(
            f"/api/v1/chat/chats/{chat.id}/messages",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "next_cursor" in data
        assert "has_more" in data
        assert isinstance(data["items"], list)


class TestContextUsage:
    async def test_get_context_usage(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture

        response = await async_client.get(
            f"/api/v1/chat/chats/{chat.id}/context-usage",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "tokens_used" in data
        assert "context_window" in data
        assert "percentage" in data
        assert isinstance(data["tokens_used"], int)
        assert isinstance(data["context_window"], int)
        assert 0 <= data["percentage"] <= 100


class TestChatCompletion:
    @pytest.mark.timeout(STREAMING_TEST_TIMEOUT)
    async def test_chat_completion_flow(
        self,
        streaming_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture
        test_prompt = "Reply with only the word 'hello'"

        completion_response = await streaming_client.post(
            "/api/v1/chat/chat",
            data={
                "prompt": test_prompt,
                "chat_id": str(chat.id),
                "model_id": "claude-haiku-4-5",
                "permission_mode": "auto",
            },
            headers=auth_headers,
        )

        assert completion_response.status_code == 200
        completion_data = completion_response.json()
        assert "chat_id" in completion_data
        assert completion_data["chat_id"] == str(chat.id)
        assert "message_id" in completion_data
        assert uuid.UUID(completion_data["message_id"])

        stream_response = await streaming_client.get(
            f"/api/v1/chat/chats/{chat.id}/stream",
            headers=auth_headers,
        )

        assert stream_response.status_code == 200
        assert "text/event-stream" in stream_response.headers.get("content-type", "")

        events = []
        for line in stream_response.text.split("\n"):
            if line.startswith("data:"):
                data = line[5:].strip()
                if data:
                    events.append(data)

        assert len(events) > 0
        has_text_event = any("assistant_text" in str(e) for e in events)
        assert has_text_event

        status_response = await streaming_client.get(
            f"/api/v1/chat/chats/{chat.id}/status",
            headers=auth_headers,
        )

        assert status_response.status_code == 200
        status_data = status_response.json()
        assert "has_active_task" in status_data

        messages_response = await streaming_client.get(
            f"/api/v1/chat/chats/{chat.id}/messages",
            headers=auth_headers,
        )

        assert messages_response.status_code == 200
        messages_data = messages_response.json()
        assert "items" in messages_data
        assert "has_more" in messages_data

        items = messages_data["items"]
        assert len(items) >= 2
        user_messages = [m for m in items if m["role"] == "user"]
        assistant_messages = [m for m in items if m["role"] == "assistant"]

        assert len(user_messages) >= 1
        assert len(assistant_messages) >= 1
        assert test_prompt in user_messages[-1]["content"]

        usage_response = await streaming_client.get(
            f"/api/v1/chat/chats/{chat.id}/context-usage",
            headers=auth_headers,
        )

        assert usage_response.status_code == 200
        usage_data = usage_response.json()
        assert usage_data["tokens_used"] > 0

    async def test_chat_completion_requires_chat_id(
        self,
        streaming_client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        response = await streaming_client.post(
            "/api/v1/chat/chat",
            data={
                "prompt": "Hello",
                "model_id": "claude-haiku-4-5",
            },
            headers=auth_headers,
        )

        assert response.status_code == 422

    async def test_chat_completion_unauthorized(
        self,
        streaming_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
    ) -> None:
        _, chat, _ = integration_chat_fixture

        response = await streaming_client.post(
            "/api/v1/chat/chat",
            data={
                "prompt": "Hello",
                "chat_id": str(chat.id),
                "model_id": "claude-haiku-4-5",
            },
        )

        assert response.status_code == 401


class TestEnhancePrompt:
    @pytest.mark.timeout(STREAMING_TEST_TIMEOUT)
    async def test_enhance_prompt(
        self,
        streaming_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        response = await streaming_client.post(
            "/api/v1/chat/enhance-prompt",
            data={
                "prompt": "make a website",
                "model_id": "claude-haiku-4-5",
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "enhanced_prompt" in data
        assert len(data["enhanced_prompt"]) > len("make a website")

    async def test_enhance_prompt_empty(
        self,
        streaming_client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        response = await streaming_client.post(
            "/api/v1/chat/enhance-prompt",
            data={
                "prompt": "",
                "model_id": "claude-haiku-4-5",
            },
            headers=auth_headers,
        )

        assert response.status_code in [400, 422]


class TestStopStream:
    async def test_stop_stream(
        self,
        async_client: AsyncClient,
        integration_chat_fixture: tuple[User, Chat, SandboxService],
        auth_headers: dict[str, str],
    ) -> None:
        _, chat, _ = integration_chat_fixture

        response = await async_client.delete(
            f"/api/v1/chat/chats/{chat.id}/stream",
            headers=auth_headers,
        )

        assert response.status_code == 204

    async def test_stop_stream_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.delete(
            f"/api/v1/chat/chats/{fake_id}/stream",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestChatUnauthorized:
    @pytest.mark.parametrize(
        "method,endpoint_template",
        [
            ("GET", "/api/v1/chat/chats/{chat_id}"),
            ("PATCH", "/api/v1/chat/chats/{chat_id}"),
            ("DELETE", "/api/v1/chat/chats/{chat_id}"),
            ("GET", "/api/v1/chat/chats/{chat_id}/messages"),
            ("GET", "/api/v1/chat/chats/{chat_id}/context-usage"),
            ("GET", "/api/v1/chat/chats/{chat_id}/stream"),
            ("GET", "/api/v1/chat/chats/{chat_id}/status"),
            ("DELETE", "/api/v1/chat/chats/{chat_id}/stream"),
            ("DELETE", "/api/v1/chat/chats/all"),
        ],
    )
    async def test_chat_endpoints_unauthorized(
        self,
        async_client: AsyncClient,
        method: str,
        endpoint_template: str,
    ) -> None:
        fake_id = str(uuid.uuid4())
        endpoint = endpoint_template.format(chat_id=fake_id)

        if method == "GET":
            response = await async_client.get(endpoint)
        elif method == "PATCH":
            response = await async_client.patch(endpoint, json={"title": "test"})
        elif method == "DELETE":
            response = await async_client.delete(endpoint)
        else:
            response = await async_client.request(method, endpoint)

        assert response.status_code == 401

    async def test_enhance_prompt_unauthorized(
        self,
        streaming_client: AsyncClient,
    ) -> None:
        response = await streaming_client.post(
            "/api/v1/chat/enhance-prompt",
            data={"prompt": "test", "model_id": "claude-haiku-4-5"},
        )

        assert response.status_code == 401


class TestChatNotFound:
    @pytest.mark.parametrize(
        "endpoint_suffix,expected_status",
        [
            ("/messages", 403),
            ("/context-usage", 404),
            ("/stream", 404),
            ("/status", 404),
        ],
    )
    async def test_chat_endpoints_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
        endpoint_suffix: str,
        expected_status: int,
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.get(
            f"/api/v1/chat/chats/{fake_id}{endpoint_suffix}",
            headers=auth_headers,
        )

        assert response.status_code == expected_status

    async def test_delete_chat_not_found(
        self,
        async_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await async_client.delete(
            f"/api/v1/chat/chats/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_chat_completion_invalid_chat(
        self,
        streaming_client: AsyncClient,
        integration_user_fixture: User,
        auth_headers: dict[str, str],
    ) -> None:
        fake_id = str(uuid.uuid4())

        response = await streaming_client.post(
            "/api/v1/chat/chat",
            data={
                "prompt": "Hello",
                "chat_id": fake_id,
                "model_id": "claude-haiku-4-5",
            },
            headers=auth_headers,
        )

        assert response.status_code == 400
