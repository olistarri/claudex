from fastapi import APIRouter, Depends

from app.core.deps import get_provider_service, get_user_service
from app.core.security import get_current_user
from app.models.db_models import User
from app.models.schemas import AIModelResponse
from app.services.provider import ProviderService
from app.services.user import UserService

router = APIRouter()


@router.get("/", response_model=list[AIModelResponse])
async def list_models(
    current_user: User = Depends(get_current_user),
    provider_service: ProviderService = Depends(get_provider_service),
    user_service: UserService = Depends(get_user_service),
) -> list[AIModelResponse]:
    user_settings = await user_service.get_user_settings(current_user.id)
    models = provider_service.get_all_models(user_settings)
    return [AIModelResponse(**model) for model in models]
