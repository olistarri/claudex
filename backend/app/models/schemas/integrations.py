from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class OAuthClientUploadRequest(BaseModel):
    client_config: dict[str, Any] = Field(
        ..., description="Contents of gcp-oauth.keys.json"
    )


class OAuthClientResponse(BaseModel):
    success: bool
    message: str


class OAuthUrlResponse(BaseModel):
    url: str


class GmailStatusResponse(BaseModel):
    connected: bool
    email: str | None = None
    connected_at: datetime | None = None
    has_oauth_client: bool = False


class DeviceCodeResponse(BaseModel):
    verification_uri: str
    user_code: str
    device_code: str
    interval: int
    expires_in: int


class PollTokenRequest(BaseModel):
    device_code: str


class OpenAIPollTokenRequest(BaseModel):
    device_code: str
    user_code: str


class PollTokenResponse(BaseModel):
    status: str
    access_token: str | None = None
    refresh_token: str | None = None
    interval: int | None = None
