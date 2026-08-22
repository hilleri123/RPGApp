from fastapi import APIRouter, Depends
from typing import List

from app.auth.user import get_current_user
from app.infrastructure.s3_service import list_images
from app import models

router = APIRouter(
    prefix="/images",
    tags=["images"]
)


@router.get("/{field}", response_model=List[str])
async def get_images(
    field: str,
    current_user: models.User = Depends(get_current_user),
):
    return list_images(field)