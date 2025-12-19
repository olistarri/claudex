from pydantic import BaseModel, Field

from app.models.types import JSONDict


class PermissionRequest(BaseModel):
    tool_name: str = Field(..., min_length=1)
    tool_input: JSONDict


class PermissionRequestResponse(BaseModel):
    request_id: str = Field(..., min_length=1)


class PermissionResult(BaseModel):
    approved: bool
    alternative_instruction: str | None = None
    user_answers: JSONDict | None = None
