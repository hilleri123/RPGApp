from __future__ import annotations

from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import Any, List

from app import models
from app.logger import logger
from app.services.template_entities import load_entity_packs_for_scenario

from app.scheme import InnerCharacter, InnerNPC, InnerFreeGameItem, Factory


def _build_item_from_entity(item: models.GameItem) -> InnerFreeGameItem:
    return InnerFreeGameItem.model_validate(
        {
            **InnerFreeGameItem.model_validate(item).model_dump(mode="python"),
            "owner_id": None,
            "location_id": None,
        }
    )


def _build_inner_character(ch: models.PlayerCharacter) -> InnerCharacter:
    owned_items: List[InnerFreeGameItem] = [
        _build_item_from_entity(link.item)
        for link in (ch.owned_item_links or [])
        if link.item is not None
    ]
    base = InnerCharacter.model_validate(ch).model_dump(mode="python")
    base.pop("location_id", None)
    base.pop("owned_items", None)
    base.pop("player", None)
    return InnerCharacter.model_validate(
        {
            **base,
            "location_id": None,
            "owned_items": owned_items,
            "player": None,
        }
    )


def _build_inner_npc(npc: models.NPC) -> InnerNPC:
    owned_items: List[InnerFreeGameItem] = [
        _build_item_from_entity(link.item)
        for link in (npc.owned_item_links or [])
        if link.item is not None
    ]
    inner_npc = InnerNPC.model_validate(npc)

    return InnerNPC.model_validate(
        {
            **inner_npc.model_dump(exclude=["owned_items"]),
            "location_id": None,
            "owned_items": owned_items,
        }
    )


async def _load_entities_for_pack(
    db: AsyncSession,
    pack: models.EntityPack,
) -> tuple[list[models.PlayerCharacter], list[models.NPC], list[models.GameItem]]:
    char_ids = [m.entity_id for m in pack.members if m.entity_kind == "player_character"]
    npc_ids = [m.entity_id for m in pack.members if m.entity_kind == "npc"]
    item_ids = [m.entity_id for m in pack.members if m.entity_kind == "game_item"]

    characters: list[models.PlayerCharacter] = []
    npcs: list[models.NPC] = []
    items: list[models.GameItem] = []

    if char_ids:
        characters = list(
            (
                await db.execute(
                    select(models.PlayerCharacter)
                    .where(models.PlayerCharacter.id.in_(char_ids))
                    .options(
                        selectinload(models.PlayerCharacter.owned_item_links).selectinload(
                            models.ItemOwnership.item
                        ),
                    )
                )
            ).scalars().all()
        )
    if npc_ids:
        npcs = list(
            (
                await db.execute(
                    select(models.NPC)
                    .where(models.NPC.id.in_(npc_ids))
                    .options(
                        selectinload(models.NPC.owned_item_links).selectinload(
                            models.ItemOwnership.item
                        ),
                    )
                )
            ).scalars().all()
        )
    if item_ids:
        items = list(
            (
                await db.execute(
                    select(models.GameItem).where(models.GameItem.id.in_(item_ids))
                )
            ).scalars().all()
        )

    return characters, npcs, items


async def load_entity_packs_for_session(
    db: AsyncSession,
    scenario_id: UUID,
) -> list[models.EntityPack]:
    logger.info(f"load_entity_packs_for_session {scenario_id=}")
    return await load_entity_packs_for_scenario(db, scenario_id)


# Backward-compatible alias
load_rule_template_sets_for_scenario = load_entity_packs_for_session


def build_factories_payload(
    packs: list[models.EntityPack],
    *,
    preloaded: dict[UUID, tuple[list[models.PlayerCharacter], list[models.NPC], list[models.GameItem]]]
    | None = None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    for pack in packs:
        if preloaded and pack.id in preloaded:
            characters, npcs, items = preloaded[pack.id]
        else:
            characters, npcs, items = [], [], []

        inner_characters: List[InnerCharacter] = [_build_inner_character(ch) for ch in characters]
        inner_npcs: List[InnerNPC] = [_build_inner_npc(npc) for npc in npcs]
        inner_items: List[InnerFreeGameItem] = [_build_item_from_entity(it) for it in items]

        factory = Factory(
            id=pack.id,
            rule_id_str=pack.rule_id_str,
            characters=inner_characters,
            npcs=inner_npcs,
            items=inner_items,
        )

        out.append(factory.model_dump(mode="json"))

    return out


async def build_factories_payload_for_scenario(
    db: AsyncSession,
    scenario_id: UUID,
) -> list[dict[str, Any]]:
    packs = await load_entity_packs_for_session(db, scenario_id)
    preloaded: dict[UUID, tuple[list, list, list]] = {}
    for pack in packs:
        preloaded[pack.id] = await _load_entities_for_pack(db, pack)
    return build_factories_payload(packs, preloaded=preloaded)
