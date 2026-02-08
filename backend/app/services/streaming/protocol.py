from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
from uuid import UUID

from app.models.types import JSONDict, JSONValue

MAX_AUDIT_STRING_LENGTH = 4096
SENSITIVE_KEY_PARTS = (
    "token",
    "api_key",
    "secret",
    "password",
    "authorization",
    "cookie",
)


StreamKind = str


@dataclass
class StreamSnapshotAccumulator:
    events: list[dict[str, Any]] = field(default_factory=list)
    text_parts: list[str] = field(default_factory=list)

    def apply(self, kind: str, payload: dict[str, Any]) -> None:
        if kind == "assistant_text":
            text = payload.get("text")
            if isinstance(text, str) and text:
                self.text_parts.append(text)

        # Keep render reconstruction deterministic without reparsing giant JSON strings.
        self.events.append({"type": kind, **payload})

    def snapshot(self) -> dict[str, Any]:
        return {
            "events": self.events,
            "segments": [],
        }

    @property
    def content_text(self) -> str:
        return "".join(self.text_parts)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate_audit_string(value: str) -> dict[str, Any]:
    if len(value) <= MAX_AUDIT_STRING_LENGTH:
        return {"value": value, "truncated": False}

    digest = sha256(value.encode("utf-8", errors="ignore")).hexdigest()
    return {
        "value": value[:MAX_AUDIT_STRING_LENGTH],
        "truncated": True,
        "sha256": digest,
        "original_length": len(value),
    }


def redact_for_audit(value: Any, key_path: tuple[str, ...] = ()) -> JSONValue:
    if isinstance(value, dict):
        redacted: JSONDict = {}
        for key, nested in value.items():
            lower = key.lower()
            if any(part in lower for part in SENSITIVE_KEY_PARTS):
                redacted[key] = "[REDACTED]"
                continue
            redacted[key] = redact_for_audit(nested, (*key_path, key))
        return redacted

    if isinstance(value, list):
        return [redact_for_audit(item, key_path) for item in value]

    if isinstance(value, (bytes, bytearray, memoryview)):
        return "[BINARY_OMITTED]"

    if isinstance(value, str):
        truncated = _truncate_audit_string(value)
        if truncated["truncated"]:
            return truncated
        return value

    if isinstance(value, (int, float, bool)) or value is None:
        return value

    return str(value)


def build_envelope(
    *,
    chat_id: UUID,
    message_id: UUID,
    stream_id: UUID,
    seq: int,
    kind: StreamKind,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "chatId": str(chat_id),
        "messageId": str(message_id),
        "streamId": str(stream_id),
        "seq": seq,
        "kind": kind,
        "payload": payload or {},
        "ts": _utc_now_iso(),
    }
