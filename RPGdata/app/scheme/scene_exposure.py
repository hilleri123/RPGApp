from __future__ import annotations
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.scheme.game_item import GameItemWithOwnerShort
from app.scheme.npc import NPCList
from app.scheme.obstacle import ObstacleCreate, ObstacleOut, ORMWithTagsModel
from app.scheme.audio import ExposureAudioLinkIn, ExposureAudioLinkOut



class TemplateNPCLink(BaseModel):
    id: UUID
    qty: int = 1

class TemplateItemLink(BaseModel):
    id: UUID
    qty: int = 1


# Для отдачи клиенту — с полным объектом
class TemplateNPCLinkOut(BaseModel):
    template_npc: NPCList  # или RuleNPCTemplateOut — что используешь
    qty: int = 1

    class Config:
        from_attributes = True

class TemplateItemLinkOut(BaseModel):
    template_item: GameItemWithOwnerShort  # или RuleItemTemplateOut
    qty: int = 1

    class Config:
        from_attributes = True



class SceneExposureBase(BaseModel):
    id: Optional[UUID] = None          # для upsert внутри Location
    name: str
    tags: Optional[list[str]] = None
    order_num: int = 0
    location_id: Optional[UUID] = None
    story_beat_id: Optional[UUID] = None


    class Config:
        from_attributes = True


class SceneExposureOut(SceneExposureBase, ORMWithTagsModel):
    items: List[GameItemWithOwnerShort] = Field(default_factory=list)
    npcs: List[NPCList] = Field(default_factory=list)
    template_npc_links: List[TemplateNPCLinkOut] = Field(default_factory=list)
    template_item_links: List[TemplateItemLinkOut] = Field(default_factory=list)
    obstacles: List[ObstacleOut] = Field(default_factory=list)
    audio_tracks: list[ExposureAudioLinkOut] = Field(default_factory=list)
    


class SceneExposureCreate(SceneExposureBase):
    npc_ids: List[UUID] = Field(default_factory=list)
    item_ids: List[UUID] = Field(default_factory=list)
    template_npc_ids: List[TemplateNPCLink] = Field(default_factory=list)   # было List[UUID]
    template_item_ids: List[TemplateItemLink] = Field(default_factory=list) # было List[UUID]
    obstacles: List[ObstacleCreate] = Field(default_factory=list)
    audio_ids: list[ExposureAudioLinkIn] = Field(default_factory=list)


class SceneExposurePreview(BaseModel):
    """Compact exposure summary for entity list cards."""

    id: UUID
    name: str
    order_num: int = 0
    tags: Optional[list[str]] = None
    npc_normal: int = 0
    npc_enemy: int = 0
    npc_dead: int = 0
    npc_enemy_dead: int = 0
    template_npc_normal: int = 0
    template_npc_enemy: int = 0
    template_npc_dead: int = 0
    template_npc_enemy_dead: int = 0
    template_npc_qty: int = 0
    item_count: int = 0
    template_item_qty: int = 0
    obstacle_count: int = 0
    audio_count: int = 0


def _npc_tag_counts(tags, qty: int = 1) -> tuple[int, int, int, int]:
    tag_set = set(tags or [])
    is_dead = "dead" in tag_set
    is_enemy = "enemy" in tag_set
    if is_dead and is_enemy:
        return 0, 0, 0, qty
    if is_enemy:
        return 0, qty, 0, 0
    if is_dead:
        return 0, 0, qty, 0
    return qty, 0, 0, 0


def build_scene_exposure_preview(se) -> SceneExposurePreview:
    normal = enemy = dead = enemy_dead = 0
    for n in se.npcs or []:
        n_add, e_add, d_add, ed_add = _npc_tag_counts(n.tags, 1)
        normal += n_add
        enemy += e_add
        dead += d_add
        enemy_dead += ed_add

    tpl_normal = tpl_enemy = tpl_dead = tpl_enemy_dead = 0
    for link in se.template_npc_links or []:
        tpl = getattr(link, "template_npc", None)
        qty = link.qty or 1
        n_add, e_add, d_add, ed_add = _npc_tag_counts(getattr(tpl, "tags", None) if tpl else [], qty)
        tpl_normal += n_add
        tpl_enemy += e_add
        tpl_dead += d_add
        tpl_enemy_dead += ed_add

    return SceneExposurePreview(
        id=se.id,
        name=se.name,
        order_num=se.order_num or 0,
        tags=se.tags,
        npc_normal=normal,
        npc_enemy=enemy,
        npc_dead=dead,
        npc_enemy_dead=enemy_dead,
        template_npc_normal=tpl_normal,
        template_npc_enemy=tpl_enemy,
        template_npc_dead=tpl_dead,
        template_npc_enemy_dead=tpl_enemy_dead,
        template_npc_qty=sum((l.qty or 1) for l in (se.template_npc_links or [])),
        item_count=len(se.items or []),
        template_item_qty=sum((l.qty or 1) for l in (se.template_item_links or [])),
        obstacle_count=len(se.obstacles or []),
        audio_count=len(se.audio_tracks or []),
    )
