from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_serializer, model_validator, computed_field, ConfigDict

from .common import UpsertPayload, UpsertResult, ORMWithTagsModel




class ItemContainedLinkIn(BaseModel):
    item_id: UUID
    take_from_other_owner: Optional[bool] = False


# --------- ORM Out (простая) ---------

class GameItemBase(BaseModel):
    name: str
    tags: Optional[list[str]] = None
    description_for_master: Optional[str] = None
    description_for_players: Optional[str] = None
    icon_url: Optional[HttpUrl] = None
    img_url: Optional[HttpUrl] = None
    quest_html_mark: Optional[str] = None


# RES GET_BY_ID
class GameItemOut(GameItemBase, ORMWithTagsModel):
    id: UUID
    source_entity_id: Optional[UUID] = None
    copied_from: Optional[UUID] = None
    data: Dict[str, Any] = {}
    owned_items: list[GameItemOut] = []

    class Config:
        from_attributes = True


class GameItem(GameItemOut):
    data: Dict[str, Any] = {}


# RES GET ALL
class GameItemList(GameItemBase, ORMWithTagsModel):
    id: UUID

    class Config:
        from_attributes = True



# IN POST/PUT
class ItemUpsertPayload(GameItemBase, UpsertPayload):
    contained_items: list[ItemContainedLinkIn] = []


# RES POST/PUT
class ItemUpsertResult(UpsertResult):
    item: Optional[GameItemOut] = None


# ------- OWNER ------------------

OwnerType = Literal["character", "npc", "item"]

class ItemOwnerShort(BaseModel):
    type: OwnerType
    id: UUID
    name: str
    icon_url: Optional[HttpUrl] = None
    img_url: Optional[HttpUrl] = None


class GameItemWithOwnerShort(GameItemList):
    model_config = ConfigDict(from_attributes=True)

    owner: Optional[ItemOwnerShort] = None

    exposure_names: Optional[list[str]] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def build_owner(cls, obj):
        # 1. Если уже dict — просто дообогащаем/возвращаем как есть
        if isinstance(obj, dict):
            data = dict(obj)
            link = data.get("ownership_link")
        else:
            # 2. ORM-объект
            if hasattr(obj, "__table__"):
                data = {
                    c.key: getattr(obj, c.key)
                    for c in obj.__table__.columns
                }
                link = getattr(obj, "ownership_link", None)

            # 3. Pydantic / произвольный объект без __table__
            else:
                if hasattr(obj, "model_dump"):
                    data = obj.model_dump()
                else:
                    data = {
                        k: v
                        for k, v in vars(obj).items()
                        if not k.startswith("_")
                    }
                link = getattr(obj, "ownership_link", None)

        owner = data.get("owner")
        if owner is None and link is not None:
            if getattr(link, "character", None) is not None:
                c = link.character
                owner = ItemOwnerShort(
                    type="character",
                    id=c.id,
                    name=c.name,
                    icon_url=getattr(c, "icon_url", None) or getattr(c, "iconurl", None),
                    img_url=getattr(c, "img_url", None) or getattr(c, "imgurl", None),
                )
            elif getattr(link, "npc", None) is not None:
                n = link.npc
                owner = ItemOwnerShort(
                    type="npc",
                    id=n.id,
                    name=n.name,
                    icon_url=getattr(n, "icon_url", None) or getattr(n, "iconurl", None),
                    img_url=getattr(n, "img_url", None) or getattr(n, "imgurl", None),
                )
            elif getattr(link, "owner_item", None) is not None:
                oi = link.owner_item
                owner = ItemOwnerShort(
                    type="item",
                    id=oi.id,
                    name=oi.name,
                    icon_url=getattr(oi, "icon_url", None) or getattr(oi, "iconurl", None),
                    img_url=getattr(oi, "img_url", None) or getattr(oi, "imgurl", None),
                )

        exposure_names = data.get("exposure_names") or []
        if not exposure_names:
            try:
                exposures = getattr(obj, "scene_exposures", None) or []
                exposure_names = [se.name for se in exposures]
            except Exception:
                exposure_names = []

        return {
            **data,
            "owner": owner,
            "exposure_names": exposure_names,
        }