from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import get_current_user
from app.infrastructure.database import get_async_session as get_db
from app.services.flaticon import FlaticonError, credit_author, download_icon, list_credits, remember_author, search_icons

class CreditIn(BaseModel):
    icon_id: int = Field(gt=0)
    author_name: str = ""

router = APIRouter(prefix="/integrations/flaticon", tags=["flaticon"])


def _fail(error: FlaticonError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.detail)


@router.get("/credits")
async def flaticon_credits(db: AsyncSession = Depends(get_db)):
    return {"items": await list_credits(db)}


@router.post("/credits")
async def remember_flaticon_credit(
    payload: CreditIn,
    _: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name, url = credit_author(payload.author_name)
    await remember_author(db, payload.icon_id, name, url)
    return {"ok": True}


@router.get("/search")
async def flaticon_search(
    q: str = "",
    _: models.User = Depends(get_current_user),
):
    try:
        hits = await search_icons(q)
    except FlaticonError as error:
        raise _fail(error) from error
    return {
        "items": [
            {
                "id": hit.id,
                "preview_url": hit.preview_url,
                "author_name": hit.author_name,
                "author_url": hit.author_url,
            }
            for hit in hits
        ]
    }


@router.get("/icons/{icon_id}")
async def flaticon_icon(
    icon_id: int,
    author_name: str = "",
    _: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        png = await download_icon(db, icon_id, author_name)
    except FlaticonError as error:
        raise _fail(error) from error
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="flaticon-{icon_id}.png"'},
    )
