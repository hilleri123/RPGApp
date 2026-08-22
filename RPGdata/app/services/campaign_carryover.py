"""Export/import entity state between campaign sessions."""

from __future__ import annotations

import copy
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app import models
from app.services.entity_data_rule import resolve_rule_id_from_data, stamp_entity_data


def _should_skip(tags: list | None) -> bool:
    if not tags:
        return False
    return "campaign_skip" in [str(t) for t in tags]


def _dump_entity(entity: Any) -> dict[str, Any]:
    if hasattr(entity, "model_dump"):
        return entity.model_dump(mode="json")
    return dict(entity)


def export_carryover_from_inner(inner: Any) -> dict[str, Any]:
    """Build JSON-serializable carryover from live session inner state."""
    characters_by_user: dict[str, dict] = {}
    player_user_ids = {str(p.user.id) for p in (inner.players or []) if getattr(p, "user", None)}

    inner_chars_by_id = {str(c.id): c for c in (inner.characters or [])}

    for p in inner.players or []:
        if not getattr(p, "user", None):
            continue
        uid = str(p.user.id)
        ch = None
        if p.character_id:
            ch = inner_chars_by_id.get(str(p.character_id))
        if ch is None and getattr(p, "character", None):
            ch = p.character
        if ch is None:
            continue
        characters_by_user[uid] = _dump_entity(ch)

    npcs: list[dict] = []
    for npc in inner.npcs or []:
        tags = getattr(npc, "tags", None) or []
        if _should_skip(tags):
            continue
        npcs.append(_dump_entity(npc))

    items: list[dict] = []
    for item in inner.items or []:
        tags = getattr(item, "tags", None) or []
        if _should_skip(tags):
            continue
        items.append(_dump_entity(item))

    return {
        "version": 2,
        "player_user_ids": sorted(player_user_ids),
        "characters_by_user": characters_by_user,
        "npcs": npcs,
        "items": items,
    }


def _create_item_from_dump(
    db: AsyncSession,
    scenario_id: UUID,
    item_data: dict,
    *,
    rule_id_str: str | None = None,
) -> UUID:
    new_id = uuid.uuid4()
    data = stamp_entity_data(
        copy.deepcopy(item_data.get("data") or {}),
        rule_id_str or resolve_rule_id_from_data(item_data.get("data")),
    )
    db.add(
        models.GameItem(
            id=new_id,
            name=item_data.get("name") or "Предмет",
            description_for_players=item_data.get("description_for_players"),
            description_for_master=item_data.get("description_for_master"),
            icon_url=item_data.get("icon_url"),
            img_url=item_data.get("img_url"),
            tags=item_data.get("tags") or [],
            data=data,
            quest_html_mark=item_data.get("quest_html_mark"),
            scenario_id=scenario_id,
        )
    )
    return new_id


def _attach_owned_items(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    owner_kind: str,
    owner_id: UUID,
    owned_items: list[dict] | None,
    rule_id_str: str | None = None,
) -> None:
    for item_data in owned_items or []:
        item_id = _create_item_from_dump(
            db,
            scenario_id,
            item_data,
            rule_id_str=rule_id_str,
        )
        kwargs: dict[str, Any] = {
            "item_id": item_id,
            "qty": item_data.get("qty") or 1,
            "equipped": bool(item_data.get("equipped")),
        }
        if owner_kind == "character":
            kwargs["character_id"] = owner_id
        elif owner_kind == "npc":
            kwargs["npc_id"] = owner_id
        else:
            continue
        db.add(models.ItemOwnership(**kwargs))


def build_application_characters(
    carryover: dict[str, Any] | None,
    user_ids: list[UUID],
) -> list[models.CharacterApplication]:
    if not carryover:
        return []
    out: list[models.CharacterApplication] = []
    chars_by_user: dict[str, dict] = carryover.get("characters_by_user") or {}
    for uid in user_ids:
        ch = chars_by_user.get(str(uid))
        if not ch:
            continue
        app_id = uuid.uuid4()
        owned = ch.get("owned_items") or []
        data = copy.deepcopy(ch.get("data") or {})
        if owned:
            data["_campaign_owned_items"] = owned
        rule_id_str = resolve_rule_id_from_data(data) or ""
        out.append(
            models.CharacterApplication(
                id=app_id,
                rule_id_str=rule_id_str,
                user_id=uid,
                name=ch.get("name") or "Персонаж",
                short_desc=ch.get("short_desc"),
                story=ch.get("story"),
                tags=ch.get("tags") or [],
                data=data,
                icon_url=ch.get("icon_url"),
                img_url=ch.get("img_url"),
                status=models.ApplicationStatus.approved,
                source_kind="campaign_carryover",
            )
        )
    return out


async def apply_carryover_after_clone(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    carryover: dict[str, Any] | None,
    character_id_by_user: dict[str, UUID],
) -> None:
    """Add carried NPCs/items and restore player inventories after scenario clone."""
    if not carryover:
        return

    scenario = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    rule_id_str = getattr(scenario, "rule_id_str", None) if scenario else None

    chars_by_user: dict[str, dict] = carryover.get("characters_by_user") or {}
    for user_id_str, ch_data in chars_by_user.items():
        char_id = character_id_by_user.get(user_id_str)
        if not char_id:
            continue
        owned = ch_data.get("owned_items") or []
        data_owned = (ch_data.get("data") or {}).get("_campaign_owned_items") or []
        _attach_owned_items(
            db,
            scenario_id=scenario_id,
            owner_kind="character",
            owner_id=char_id,
            owned_items=owned or data_owned,
            rule_id_str=rule_id_str,
        )

    for npc_data in carryover.get("npcs") or []:
        new_npc_id = uuid.uuid4()
        db.add(
            models.NPC(
                id=new_npc_id,
                name=npc_data.get("name") or "NPC",
                description_for_players=npc_data.get("description_for_players"),
                description_for_master=npc_data.get("description_for_master"),
                icon_url=npc_data.get("icon_url"),
                img_url=npc_data.get("img_url"),
                tags=npc_data.get("tags") or [],
                data=stamp_entity_data(
                    copy.deepcopy(npc_data.get("data") or {}),
                    rule_id_str or resolve_rule_id_from_data(npc_data.get("data")),
                ),
                scenario_id=scenario_id,
            )
        )
        await db.flush()
        _attach_owned_items(
            db,
            scenario_id=scenario_id,
            owner_kind="npc",
            owner_id=new_npc_id,
            owned_items=npc_data.get("owned_items"),
            rule_id_str=rule_id_str,
        )

    for item_data in carryover.get("items") or []:
        _create_item_from_dump(db, scenario_id, item_data, rule_id_str=rule_id_str)

    await db.flush()
