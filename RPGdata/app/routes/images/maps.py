from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import List
import uuid

from app.auth.user import get_current_user
from app.infrastructure.s3_service import upload_file, list_images
from app import models

router = APIRouter(
    prefix="/images/maps",
    tags=["images"]
)


@router.get("", response_model=List[str])
async def get_maps(
    current_user: models.User = Depends(get_current_user),
):
    return list_images("maps")


@router.post("", response_model=str)
async def upload_map(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    name = str(uuid.uuid4())
    return await upload_file(file, "maps", name)
