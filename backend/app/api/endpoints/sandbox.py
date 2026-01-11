from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.deps import (
    SandboxContext,
    get_sandbox_context,
    get_sandbox_service_for_context,
)
from app.models.schemas import (
    AddSecretRequest,
    BrowserStatusResponse,
    FileContentResponse,
    FileMetadata,
    IDEUrlResponse,
    MessageResponse,
    PortPreviewLink,
    PreviewLinksResponse,
    SandboxFilesMetadataResponse,
    SecretResponse,
    SecretsListResponse,
    StartBrowserRequest,
    UpdateFileRequest,
    UpdateFileResponse,
    UpdateIDEThemeRequest,
    UpdateSecretRequest,
    VNCUrlResponse,
)
from app.services.exceptions import SandboxException
from app.services.sandbox import SandboxService


router = APIRouter()


@router.get("/{sandbox_id}/preview-links", response_model=PreviewLinksResponse)
async def get_preview_links(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> PreviewLinksResponse:
    links = await sandbox_service.get_preview_links(context.sandbox_id)
    return PreviewLinksResponse(links=[PortPreviewLink(**link) for link in links])


@router.get("/{sandbox_id}/ide-url", response_model=IDEUrlResponse)
async def get_ide_url(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> IDEUrlResponse:
    url = await sandbox_service.get_ide_url(context.sandbox_id)
    return IDEUrlResponse(url=url)


@router.get("/{sandbox_id}/vnc-url", response_model=VNCUrlResponse)
async def get_vnc_url(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> VNCUrlResponse:
    url = await sandbox_service.get_vnc_url(context.sandbox_id)
    return VNCUrlResponse(url=url)


@router.post("/{sandbox_id}/browser/start", response_model=BrowserStatusResponse)
async def start_browser(
    request: StartBrowserRequest,
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> BrowserStatusResponse:
    try:
        await sandbox_service.start_browser(context.sandbox_id, request.url)
        return BrowserStatusResponse(running=True, current_url=request.url)
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start browser: {str(e)}",
        )


@router.post("/{sandbox_id}/browser/stop", response_model=MessageResponse)
async def stop_browser(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> MessageResponse:
    try:
        await sandbox_service.stop_browser(context.sandbox_id)
        return MessageResponse(message="Browser stopped")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop browser: {str(e)}",
        )


@router.get("/{sandbox_id}/browser/status", response_model=BrowserStatusResponse)
async def get_browser_status(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> BrowserStatusResponse:
    result = await sandbox_service.get_browser_status(context.sandbox_id)
    return BrowserStatusResponse(running=result.get("running", False))


@router.get(
    "/{sandbox_id}/files/metadata",
    response_model=SandboxFilesMetadataResponse,
)
async def get_files_metadata(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> SandboxFilesMetadataResponse:
    files = await sandbox_service.get_files_metadata(context.sandbox_id)
    return SandboxFilesMetadataResponse(files=[FileMetadata(**f) for f in files])


@router.get(
    "/{sandbox_id}/files/content/{file_path:path}", response_model=FileContentResponse
)
async def get_file_content(
    file_path: str,
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> FileContentResponse:
    try:
        file_data = await sandbox_service.get_file_content(
            context.sandbox_id, file_path
        )
        return FileContentResponse(**file_data)
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file content: {str(e)}",
        )


@router.put("/{sandbox_id}/files", response_model=UpdateFileResponse)
async def update_file_in_sandbox(
    request: UpdateFileRequest,
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> UpdateFileResponse:
    try:
        await sandbox_service.write_file(
            context.sandbox_id, request.file_path, request.content
        )
        return UpdateFileResponse(
            success=True, message=f"File {request.file_path} updated successfully"
        )
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update file: {str(e)}",
        )


@router.get("/{sandbox_id}/secrets", response_model=SecretsListResponse)
async def get_secrets(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> SecretsListResponse:
    try:
        secrets = await sandbox_service.get_secrets(context.sandbox_id)
        return SecretsListResponse(secrets=[SecretResponse(**s) for s in secrets])
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get secrets: {str(e)}",
        )


@router.post("/{sandbox_id}/secrets", response_model=MessageResponse)
async def add_secret(
    secret_data: AddSecretRequest,
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> MessageResponse:
    try:
        await sandbox_service.add_secret(
            context.sandbox_id, secret_data.key, secret_data.value
        )
        return MessageResponse(message=f"Secret {secret_data.key} added successfully")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add secret: {str(e)}",
        )


@router.put("/{sandbox_id}/secrets/{key}", response_model=MessageResponse)
async def update_secret(
    key: str,
    secret_data: UpdateSecretRequest,
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> MessageResponse:
    try:
        await sandbox_service.update_secret(context.sandbox_id, key, secret_data.value)
        return MessageResponse(message=f"Secret {key} updated successfully")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update secret: {str(e)}",
        )


@router.delete("/{sandbox_id}/secrets/{key}", response_model=MessageResponse)
async def delete_secret(
    key: str,
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> MessageResponse:
    try:
        await sandbox_service.delete_secret(context.sandbox_id, key)
        return MessageResponse(message=f"Secret {key} deleted successfully")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete secret: {str(e)}",
        )


@router.put("/{sandbox_id}/ide-theme", response_model=MessageResponse)
async def update_ide_theme(
    request: UpdateIDEThemeRequest,
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> MessageResponse:
    try:
        await sandbox_service.update_ide_theme(context.sandbox_id, request.theme)
        return MessageResponse(message=f"IDE theme updated to {request.theme}")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update IDE theme: {str(e)}",
        )


@router.get("/{sandbox_id}/download-zip")
async def download_sandbox_files(
    context: SandboxContext = Depends(get_sandbox_context),
    sandbox_service: SandboxService = Depends(get_sandbox_service_for_context),
) -> Response:
    try:
        zip_bytes = await sandbox_service.generate_zip_download(context.sandbox_id)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="sandbox_{context.sandbox_id}.zip"'
            },
        )
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate zip file: {str(e)}",
        )
