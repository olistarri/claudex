from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.db_models import User
from app.models.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectSettingsUpdate,
    ProjectUpdate,
)
from app.services.exceptions import ChatException
from app.services.project import ProjectService
from app.db.session import SessionLocal

router = APIRouter()


def get_project_service() -> ProjectService:
    return ProjectService(session_factory=SessionLocal)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> list[ProjectResponse]:
    projects = await project_service.get_user_projects(current_user.id)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    try:
        project = await project_service.create_project(current_user.id, data)
    except ChatException as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    try:
        project = await project_service.get_project(project_id, current_user.id)
    except ChatException as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    try:
        project = await project_service.update_project(
            project_id, current_user.id, data
        )
    except ChatException as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> None:
    try:
        await project_service.delete_project(project_id, current_user.id)
    except ChatException as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.patch("/{project_id}/settings", response_model=ProjectResponse)
async def update_project_settings(
    project_id: UUID,
    data: ProjectSettingsUpdate,
    current_user: User = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    try:
        project = await project_service.update_project_settings(
            project_id, current_user.id, data
        )
    except ChatException as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return ProjectResponse.model_validate(project)
