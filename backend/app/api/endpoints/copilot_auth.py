from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.security import get_current_user
from app.models.db_models import User

router = APIRouter()
settings = get_settings()
DEVICE_CODE_URL = "https://github.com/login/device/code"
ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"


class DeviceCodeResponse(BaseModel):
    verification_uri: str
    user_code: str
    device_code: str
    interval: int
    expires_in: int


class PollTokenRequest(BaseModel):
    device_code: str


class PollTokenResponse(BaseModel):
    status: str
    access_token: str | None = None
    interval: int | None = None


@router.post("/device-code", response_model=DeviceCodeResponse)
async def start_device_flow(
    _current_user: User = Depends(get_current_user),
) -> DeviceCodeResponse:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            DEVICE_CODE_URL,
            headers={"Accept": "application/json"},
            data={"client_id": settings.GITHUB_CLIENT_ID, "scope": "read:user"},
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="Failed to initiate GitHub device authorization",
        )

    data: dict[str, Any] = resp.json()
    return DeviceCodeResponse(
        verification_uri=data["verification_uri"],
        user_code=data["user_code"],
        device_code=data["device_code"],
        interval=data.get("interval", 5),
        expires_in=data.get("expires_in", 900),
    )


@router.post("/poll-token", response_model=PollTokenResponse)
async def poll_token(
    request: PollTokenRequest,
    _current_user: User = Depends(get_current_user),
) -> PollTokenResponse:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            ACCESS_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "device_code": request.device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub token request failed")

    data: dict[str, Any] = resp.json()

    if data.get("access_token"):
        return PollTokenResponse(status="success", access_token=data["access_token"])

    error = data.get("error", "unknown")
    if error == "authorization_pending":
        return PollTokenResponse(status="pending")
    if error == "slow_down":
        interval = data.get("interval")
        if isinstance(interval, int) and interval > 0:
            return PollTokenResponse(status="slow_down", interval=interval)
        return PollTokenResponse(status="slow_down")

    raise HTTPException(status_code=400, detail=f"Authorization failed: {error}")
