"""
app/scheme/application.py
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models import ApplicationStatus
from app.models import ItemRequestStatus
from app.scheme.character import CharacterDataBase, CharacterProfileFields


# ── Общее ─────────────────────────────────────────────────────────────────────

class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: Optional[str] = None
    icon_url: Optional[str] = None


# ── Review ────────────────────────────────────────────────────────────────────

class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    application_id: UUID
    author: Optional[AuthorOut] = None
    status_set_to: ApplicationStatus
    comment: Optional[str] = None
    proposed_data: Optional[dict] = None
    is_player_note: bool
    created_at: datetime


# ── ItemRequest ───────────────────────────────────────────────────────────────

class ItemRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    application_id: UUID
    requested_item_id: Optional[UUID] = None
    requested_name: Optional[str] = None
    player_comment: Optional[str] = None
    status: ItemRequestStatus
    master_comment: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime


# ── GrantedItem ───────────────────────────────────────────────────────────────

class GrantedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    application_id: UUID
    item_id: UUID
    item_request_id: Optional[UUID] = None
    master_comment: Optional[str] = None
    granted_at: datetime
    granted_by_id: Optional[UUID] = None


# ── ApplicationListOut (игрок) ────────────────────────────────────────────────

class ApplicationListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rule_id_str: str
    name: str
    short_desc: Optional[str] = None
    status: ApplicationStatus
    icon_url: Optional[str] = None
    tags: Optional[list] = None
    player_character_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None


# ── ApplicationOut (игрок) ────────────────────────────────────────────────────

class ApplicationOut(ApplicationListOut):
    story: Optional[str] = None
    data: Optional[dict] = None
    img_url: Optional[str] = None
    player_comment: Optional[str] = None
    reviews: List[ReviewOut] = []
    item_requests: List[ItemRequestOut] = []
    granted_items: List[GrantedItemOut] = []


# ── MasterApplicationListOut (мастер) ────────────────────────────────────────

class MasterApplicationListOut(ApplicationListOut):
    user: Optional[AuthorOut] = None


# ── MasterApplicationOut (мастер) ────────────────────────────────────────────

class MasterApplicationOut(ApplicationOut):
    user: Optional[AuthorOut] = None


# ── Входящие payload-ы ────────────────────────────────────────────────────────

class ApplicationBase(CharacterProfileFields):
    model_config = ConfigDict(from_attributes=True)
    rule_id_str: str
    player_comment: Optional[str] = None
    

class ApplicationCreatePayload(CharacterDataBase):
    rule_id_str: str
    player_comment: Optional[str] = None


class ApplicationUpdatePayload(ApplicationBase):
    pass


class PlayerReviewPayload(BaseModel):
    comment: str


class ItemRequestCreatePayload(BaseModel):
    requested_item_id: Optional[UUID] = None
    requested_name: Optional[str] = None
    player_comment: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "requested_name": "Длинный меч +1",
                "player_comment": "Хочу его как фамильное оружие",
            }
        }
    )


class ItemRequestUpdatePayload(BaseModel):
    requested_name: Optional[str] = None
    player_comment: Optional[str] = None


class MasterReviewPayload(BaseModel):
    new_status: ApplicationStatus
    comment: Optional[str] = None
    proposed_data: Optional[dict] = None


class ItemRequestDecisionPayload(BaseModel):
    status: ItemRequestStatus
    master_comment: Optional[str] = None


class GrantItemPayload(BaseModel):
    item_id: UUID
    item_request_id: Optional[UUID] = None
    master_comment: Optional[str] = None




class ApplicationValidatePayload(BaseModel):
    rule_id_str: str
    name: str
    data: Optional[dict] = None
    tags: Optional[List[str]] = None

class ValidateResult(BaseModel):
    ok: bool
    issues: List[dict] = []
    data: Optional[dict] = None