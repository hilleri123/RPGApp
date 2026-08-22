"""Deep-copy a scenario for session runtime (new UUIDs, remapped FKs)."""

from __future__ import annotations

import copy
import uuid
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.services.entity_data_rule import stamp_entity_data
from app.models.scenario.story_beat import story_beat_location, story_beat_npc
from app.models.scenario.scene_exposure import (
    scene_exposure_item,
    scene_exposure_npc,
    scene_exposure_obstacle,
)


@dataclass
class CloneResult:
    scenario: models.Scenario
    id_map: dict[UUID, UUID] = field(default_factory=dict)


class IdMap:
    def __init__(self) -> None:
        self._m: dict[UUID, UUID] = {}

    def register(self, old_id: UUID, new_id: UUID | None = None) -> UUID:
        new = new_id or uuid.uuid4()
        self._m[old_id] = new
        return new

    def remap(self, old_id: UUID | None) -> UUID | None:
        if old_id is None:
            return None
        return self._m.get(old_id)


def _scenario_load_stmt(scenario_id: UUID):
    _scenario = select(models.Scenario).where(models.Scenario.id == scenario_id)
    _locations = selectinload(models.Scenario.locations)
    _story_beats = selectinload(models.Scenario.story_beats)
    _characters = selectinload(models.Scenario.characters)

    _location_exposures = _locations.selectinload(models.Location.scene_exposures)
    _story_beat_exposures = _story_beats.selectinload(models.StoryBeat.scene_exposures)

    def _exposure_options(base):
        return [
            base.selectinload(models.SceneExposure.npcs),
            base.selectinload(models.SceneExposure.items),
            base.selectinload(models.SceneExposure.obstacles),
            base.selectinload(models.SceneExposure.template_npc_links),
            base.selectinload(models.SceneExposure.template_item_links),
            base.selectinload(models.SceneExposure.audio_tracks),
        ]

    return _scenario.options(
        selectinload(models.Scenario.user),
        _locations.selectinload(models.Location.map_objects),
        *_exposure_options(_location_exposures),
        _story_beats.selectinload(models.StoryBeat.locations),
        _story_beats.selectinload(models.StoryBeat.npcs),
        *_exposure_options(_story_beat_exposures),
        _characters.selectinload(models.PlayerCharacter.owned_item_links).selectinload(
            models.ItemOwnership.item
        ),
        selectinload(models.Scenario.npcs)
        .selectinload(models.NPC.owned_item_links)
        .selectinload(models.ItemOwnership.item),
        selectinload(models.Scenario.items).selectinload(models.GameItem.ownership_link),
        selectinload(models.Scenario.items).selectinload(models.GameItem.contained_item_links),
        selectinload(models.Scenario.notes),
        selectinload(models.Scenario.counters),
        selectinload(models.Scenario.obstacles),
        selectinload(models.Scenario.todos),
        selectinload(models.Scenario.entity_pack_links),
        selectinload(models.Scenario.name_pack_links),
        selectinload(models.Scenario.scenario_tags),
        selectinload(models.Scenario.fronts).selectinload(models.Front.members),
        selectinload(models.Scenario.fronts).selectinload(models.Front.wiki_notes),
        selectinload(models.Scenario.fronts).selectinload(models.Front.tag),
    )


def _copy_scalar_columns(
    obj: Any,
    model_cls: type,
    *,
    exclude: frozenset[str] = frozenset(),
    rule_id_str: str | None = None,
) -> dict[str, Any]:
    cols = {c.name for c in model_cls.__table__.columns}
    data: dict[str, Any] = {}
    for name in cols:
        if name in exclude or name in ("id", "source_entity_id"):
            continue
        value = getattr(obj, name)
        if name == "data" and isinstance(value, dict):
            value = stamp_entity_data(copy.deepcopy(value), rule_id_str)
        data[name] = value
    return data


async def _copy_owned_template_sets(
    db: AsyncSession,
    *,
    source_scenario_id: UUID,
    target_scenario_id: UUID,
) -> IdMap:
    """Clone primary entity pack and its template entities for duplicated scenario."""
    from app.constants.templates import ensure_template_tags

    template_id_map = IdMap()

    src_link = (
        await db.execute(
            select(models.ScenarioEntityPackLink)
            .where(models.ScenarioEntityPackLink.scenario_id == source_scenario_id)
            .order_by(models.ScenarioEntityPackLink.order_num.asc())
        )
    ).scalars().first()
    if not src_link:
        return template_id_map

    src_pack = (
        await db.execute(
            select(models.EntityPack)
            .where(models.EntityPack.id == src_link.pack_id)
            .options(selectinload(models.EntityPack.members))
        )
    ).scalars().first()
    if not src_pack:
        return template_id_map

    new_pack = models.EntityPack(
        rule_id_str=src_pack.rule_id_str,
        name=src_pack.name,
        tags=list(src_pack.tags or []),
    )
    db.add(new_pack)
    await db.flush()

    db.add(
        models.ScenarioEntityPackLink(
            scenario_id=target_scenario_id,
            pack_id=new_pack.id,
            enabled=True,
            order_num=0,
        )
    )

    char_ids = [m.entity_id for m in src_pack.members if m.entity_kind == "player_character"]
    npc_ids = [m.entity_id for m in src_pack.members if m.entity_kind == "npc"]
    item_ids = [m.entity_id for m in src_pack.members if m.entity_kind == "game_item"]

    item_by_old: dict[UUID, models.GameItem] = {}
    item_links_by_old: dict[UUID, list] = {}
    for old_id in item_ids:
        item = (
            await db.execute(
                select(models.GameItem)
                .where(models.GameItem.id == old_id)
                .options(selectinload(models.GameItem.contained_item_links))
            )
        ).scalars().first()
        if not item:
            continue
        item_links_by_old[item.id] = list(item.contained_item_links or [])
        new_id = template_id_map.register(item.id)
        new_item = models.GameItem(
            id=new_id,
            **_copy_scalar_columns(
                item,
                models.GameItem,
                exclude=frozenset({"scenario_id"}),
                rule_id_str=src_pack.rule_id_str,
            ),
            scenario_id=None,
            tags=ensure_template_tags(item.tags),
        )
        db.add(new_item)
        item_by_old[item.id] = new_item
    await db.flush()

    npc_by_old: dict[UUID, models.NPC] = {}
    npc_links_by_old: dict[UUID, list] = {}
    for old_id in npc_ids:
        npc = (
            await db.execute(
                select(models.NPC)
                .where(models.NPC.id == old_id)
                .options(selectinload(models.NPC.owned_item_links))
            )
        ).scalars().first()
        if not npc:
            continue
        npc_links_by_old[npc.id] = list(npc.owned_item_links or [])
        new_id = template_id_map.register(npc.id)
        new_npc = models.NPC(
            id=new_id,
            **_copy_scalar_columns(
                npc,
                models.NPC,
                exclude=frozenset({"scenario_id"}),
                rule_id_str=src_pack.rule_id_str,
            ),
            scenario_id=None,
            tags=ensure_template_tags(npc.tags),
        )
        db.add(new_npc)
        npc_by_old[npc.id] = new_npc
        db.add(
            models.EntityPackMember(
                pack_id=new_pack.id, entity_kind="npc", entity_id=new_id
            )
        )
    await db.flush()

    char_by_old: dict[UUID, models.PlayerCharacter] = {}
    char_links_by_old: dict[UUID, list] = {}
    for old_id in char_ids:
        ch = (
            await db.execute(
                select(models.PlayerCharacter)
                .where(models.PlayerCharacter.id == old_id)
                .options(selectinload(models.PlayerCharacter.owned_item_links))
            )
        ).scalars().first()
        if not ch:
            continue
        char_links_by_old[ch.id] = list(ch.owned_item_links or [])
        new_id = template_id_map.register(ch.id)
        new_ch = models.PlayerCharacter(
            id=new_id,
            **_copy_scalar_columns(
                ch,
                models.PlayerCharacter,
                exclude=frozenset({"scenario_id"}),
                rule_id_str=src_pack.rule_id_str,
            ),
            scenario_id=None,
            tags=ensure_template_tags(ch.tags),
        )
        db.add(new_ch)
        char_by_old[ch.id] = new_ch
        db.add(
            models.EntityPackMember(
                pack_id=new_pack.id, entity_kind="player_character", entity_id=new_id
            )
        )
    await db.flush()

    for item in item_by_old.values():
        db.add(
            models.EntityPackMember(
                pack_id=new_pack.id, entity_kind="game_item", entity_id=item.id
            )
        )
    await db.flush()

    for old_npc_id, links in npc_links_by_old.items():
        new_npc_id = template_id_map.remap(old_npc_id)
        if new_npc_id is None:
            continue
        for link in links:
            new_item_id = template_id_map.remap(link.item_id)
            if new_item_id is None:
                continue
            db.add(
                models.ItemOwnership(
                    item_id=new_item_id,
                    npc_id=new_npc_id,
                    qty=link.qty,
                    equipped=link.equipped,
                )
            )

    for old_ch_id, links in char_links_by_old.items():
        new_ch_id = template_id_map.remap(old_ch_id)
        if new_ch_id is None:
            continue
        for link in links:
            new_item_id = template_id_map.remap(link.item_id)
            if new_item_id is None:
                continue
            db.add(
                models.ItemOwnership(
                    item_id=new_item_id,
                    character_id=new_ch_id,
                    qty=link.qty,
                    equipped=link.equipped,
                )
            )

    for old_item_id, links in item_links_by_old.items():
        new_owner_id = template_id_map.remap(old_item_id)
        if new_owner_id is None:
            continue
        for link in links:
            new_contained_id = template_id_map.remap(link.item_id)
            if new_contained_id is None:
                continue
            db.add(
                models.ItemOwnership(
                    item_id=new_contained_id,
                    owner_item_id=new_owner_id,
                    qty=link.qty,
                    equipped=link.equipped,
                )
            )

    await db.flush()
    return template_id_map


async def _remap_exposure_template_links(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    template_id_map: IdMap,
) -> None:
    if not template_id_map._m:
        return

    exposures = (
        await db.execute(
            select(models.SceneExposure)
            .where(models.SceneExposure.scenario_id == scenario_id)
            .options(
                selectinload(models.SceneExposure.template_npc_links),
                selectinload(models.SceneExposure.template_item_links),
            )
        )
    ).scalars().all()

    for se in exposures:
        for link in se.template_npc_links or []:
            new_id = template_id_map.remap(link.template_npc_id)
            if new_id is not None:
                link.template_npc_id = new_id
        for link in se.template_item_links or []:
            new_id = template_id_map.remap(link.template_item_id)
            if new_id is not None:
                link.template_item_id = new_id

    await db.flush()


async def _clone_scenario(
    db: AsyncSession,
    *,
    source_scenario_id: UUID,
    new_name: str,
    owner_user_id: UUID,
    is_session_snapshot: bool,
    application_characters: list[models.CharacterApplication] | None = None,
) -> CloneResult:
    """
    Deep-copy scenario entities with new UUIDs and remapped FKs.
    """
    application_characters = application_characters or []

    src: models.Scenario | None = (
        await db.execute(_scenario_load_stmt(source_scenario_id))
    ).scalars().first()
    if not src:
        raise ValueError(f"scenario not found: {source_scenario_id}")

    id_map = IdMap()
    clone_rule_id = src.rule_id_str

    new_scenario = models.Scenario(
        name=new_name or src.name,
        intro=src.intro,
        max_players=src.max_players,
        rule_id_str=src.rule_id_str,
        icon_url=src.icon_url,
        user_id=owner_user_id,
        data=copy.deepcopy(src.data) if src.data else {},
        tags=copy.deepcopy(src.tags) if src.tags else None,
        scenario_starts_at=src.scenario_starts_at,
        source_scenario_id=src.id,
        is_session_snapshot=is_session_snapshot,
    )
    db.add(new_scenario)
    await db.flush()
    new_sid = new_scenario.id

    # obstacles
    obstacle_by_old: dict[UUID, models.Obstacle] = {}
    for ob in src.obstacles or []:
        new_id = id_map.register(ob.id)
        new_ob = models.Obstacle(
            id=new_id,
            source_entity_id=ob.id,
            **_copy_scalar_columns(
                ob,
                models.Obstacle,
                exclude=frozenset({"scenario_id"}),
                rule_id_str=clone_rule_id,
            ),
            scenario_id=new_sid,
        )
        db.add(new_ob)
        obstacle_by_old[ob.id] = new_ob
    await db.flush()

    # locations (parent deferred)
    location_by_old: dict[UUID, models.Location] = {}
    for loc in src.locations or []:
        new_id = id_map.register(loc.id)
        new_loc = models.Location(
            id=new_id,
            source_entity_id=loc.id,
            **_copy_scalar_columns(
                loc,
                models.Location,
                exclude=frozenset({"scenario_id", "parent_location_id"}),
                rule_id_str=clone_rule_id,
            ),
            scenario_id=new_sid,
            parent_location_id=None,
        )
        db.add(new_loc)
        location_by_old[loc.id] = new_loc
    await db.flush()

    for old_loc in src.locations or []:
        if old_loc.parent_location_id:
            new_loc = location_by_old[old_loc.id]
            new_loc.parent_location_id = id_map.remap(old_loc.parent_location_id)

    # map objects
    for old_loc in src.locations or []:
        new_loc_id = id_map.remap(old_loc.id)
        for mo in old_loc.map_objects or []:
            new_mo_id = id_map.register(mo.id)
            db.add(
                models.MapObjectPolygon(
                    id=new_mo_id,
                    source_entity_id=mo.id,
                    **_copy_scalar_columns(
                        mo,
                        models.MapObjectPolygon,
                        exclude=frozenset({"source_location_id", "target_location_id"}),
                    ),
                    source_location_id=new_loc_id,
                    target_location_id=id_map.remap(mo.target_location_id),
                )
            )
    await db.flush()

    # npcs
    npc_by_old: dict[UUID, models.NPC] = {}
    for npc in src.npcs or []:
        new_id = id_map.register(npc.id)
        new_npc = models.NPC(
            id=new_id,
            source_entity_id=npc.id,
            **_copy_scalar_columns(
                npc,
                models.NPC,
                exclude=frozenset({"scenario_id"}),
                rule_id_str=clone_rule_id,
            ),
            scenario_id=new_sid,
        )
        db.add(new_npc)
        npc_by_old[npc.id] = new_npc
    await db.flush()

    # items
    item_by_old: dict[UUID, models.GameItem] = {}
    for item in src.items or []:
        new_id = id_map.register(item.id)
        new_item = models.GameItem(
            id=new_id,
            source_entity_id=item.id,
            **_copy_scalar_columns(
                item,
                models.GameItem,
                exclude=frozenset({"scenario_id"}),
                rule_id_str=clone_rule_id,
            ),
            scenario_id=new_sid,
        )
        db.add(new_item)
        item_by_old[item.id] = new_item
    await db.flush()

    # characters from scenario
    char_by_old: dict[UUID, models.PlayerCharacter] = {}
    for ch in src.characters or []:
        new_id = id_map.register(ch.id)
        new_ch = models.PlayerCharacter(
            id=new_id,
            source_entity_id=ch.id,
            **_copy_scalar_columns(
                ch,
                models.PlayerCharacter,
                exclude=frozenset({"scenario_id", "location_id", "bound_user_id"}),
                rule_id_str=clone_rule_id,
            ),
            scenario_id=new_sid,
            location_id=id_map.remap(ch.location_id),
            bound_user_id=None,
        )
        db.add(new_ch)
        char_by_old[ch.id] = new_ch

    # application-imported characters: attach pool rows (no duplicate clone)
    if application_characters:
        from app.services.application_entity_service import attach_application_characters_to_scenario

        attached = await attach_application_characters_to_scenario(
            db,
            scenario_id=new_sid,
            applications=application_characters,
        )
        for pc_id, pc in attached.items():
            # Pool characters keep their id — identity map, no phantom UUID.
            if pc_id not in id_map._m:
                id_map.register(pc_id, pc_id)
            char_by_old[pc_id] = pc

    await db.flush()

    # item ownership (after all owners exist)
    all_ownership_sources = list(src.npcs or []) + list(src.characters or [])
    for owner_obj in all_ownership_sources:
        for link in getattr(owner_obj, "owned_item_links", None) or []:
            old_item_id = link.item_id
            if old_item_id not in item_by_old and old_item_id not in id_map._m:
                continue
            new_item_id = id_map.remap(old_item_id)
            kwargs: dict[str, Any] = {
                "item_id": new_item_id,
                "qty": link.qty,
                "equipped": link.equipped,
            }
            if isinstance(owner_obj, models.NPC):
                kwargs["npc_id"] = id_map.remap(owner_obj.id)
            else:
                kwargs["character_id"] = id_map.remap(owner_obj.id)
            db.add(models.ItemOwnership(**kwargs))

    # container items
    for item in src.items or []:
        for link in getattr(item, "contained_item_links", None) or []:
            db.add(
                models.ItemOwnership(
                    item_id=id_map.remap(link.item_id),
                    owner_item_id=id_map.remap(item.id),
                    qty=link.qty,
                    equipped=link.equipped,
                )
            )
    await db.flush()

    # notes
    note_by_old: dict = {}
    for note in src.notes or []:
        new_id = id_map.register(note.id)
        new_note = models.Note(
            id=new_id,
            source_entity_id=note.id,
            **_copy_scalar_columns(
                note,
                models.Note,
                exclude=frozenset({"scenario_id", "parent_note_id"}),
                rule_id_str=clone_rule_id,
            ),
            scenario_id=new_sid,
            parent_note_id=None,
        )
        db.add(new_note)
        note_by_old[note.id] = new_note
    await db.flush()

    for old_note in src.notes or []:
        if old_note.parent_note_id:
            note_by_old[old_note.id].parent_note_id = id_map.remap(old_note.parent_note_id)
    await db.flush()

    # counters
    for counter in src.counters or []:
        new_id = id_map.register(counter.id)
        db.add(
            models.Counter(
                id=new_id,
                source_entity_id=counter.id,
                **_copy_scalar_columns(
                    counter,
                    models.Counter,
                    exclude=frozenset({"scenario_id", "character_id"}),
                    rule_id_str=clone_rule_id,
                ),
                scenario_id=new_sid,
                character_id=id_map.remap(counter.character_id),
            )
        )
    await db.flush()

    # story beats (parent deferred)
    beat_by_old: dict[UUID, models.StoryBeat] = {}
    for sb in src.story_beats or []:
        new_id = id_map.register(sb.id)
        new_sb = models.StoryBeat(
            id=new_id,
            source_entity_id=sb.id,
            **_copy_scalar_columns(
                sb,
                models.StoryBeat,
                exclude=frozenset({"scenario_id", "parent_story_beat_id"}),
                rule_id_str=clone_rule_id,
            ),
            scenario_id=new_sid,
            parent_story_beat_id=None,
        )
        db.add(new_sb)
        beat_by_old[sb.id] = new_sb
    await db.flush()

    for old_sb in src.story_beats or []:
        if old_sb.parent_story_beat_id:
            beat_by_old[old_sb.id].parent_story_beat_id = id_map.remap(old_sb.parent_story_beat_id)

    # story beat M2M (direct inserts — safe in async ORM)
    for old_sb in src.story_beats or []:
        new_sb_id = id_map.remap(old_sb.id)
        for loc in old_sb.locations or []:
            if loc.id in location_by_old:
                await db.execute(
                    insert(story_beat_location).values(
                        story_beat_id=new_sb_id,
                        location_id=id_map.remap(loc.id),
                    )
                )
        for npc in old_sb.npcs or []:
            if npc.id in npc_by_old:
                await db.execute(
                    insert(story_beat_npc).values(
                        story_beat_id=new_sb_id,
                        npc_id=id_map.remap(npc.id),
                    )
                )

    # scene exposures on locations and story beats
    exposure_by_old: dict[UUID, models.SceneExposure] = {}

    async def _copy_exposure_m2m(old_se: models.SceneExposure, new_se_id: UUID) -> None:
        for npc in old_se.npcs or []:
            if npc.id in npc_by_old:
                await db.execute(
                    insert(scene_exposure_npc).values(
                        scene_exposure_id=new_se_id,
                        npc_id=id_map.remap(npc.id),
                    )
                )
        for item in old_se.items or []:
            if item.id in item_by_old:
                await db.execute(
                    insert(scene_exposure_item).values(
                        scene_exposure_id=new_se_id,
                        item_id=id_map.remap(item.id),
                    )
                )
        for obstacle in old_se.obstacles or []:
            if obstacle.id in obstacle_by_old:
                await db.execute(
                    insert(scene_exposure_obstacle).values(
                        scene_exposure_id=new_se_id,
                        obstacle_id=id_map.remap(obstacle.id),
                    )
                )

    def _copy_exposure_links(old_se: models.SceneExposure, new_se_id: UUID) -> None:
        for link in old_se.template_npc_links or []:
            db.add(
                models.SceneExposureTemplateNPC(
                    scene_exposure_id=new_se_id,
                    template_npc_id=link.template_npc_id,
                    qty=link.qty,
                )
            )
        for link in old_se.template_item_links or []:
            db.add(
                models.SceneExposureTemplateItem(
                    scene_exposure_id=new_se_id,
                    template_item_id=link.template_item_id,
                    qty=link.qty,
                )
            )
        for al in old_se.audio_tracks or []:
            db.add(
                models.SceneExposureAudio(
                    scene_exposure_id=new_se_id,
                    audio_track_id=al.audio_track_id,
                    volume=al.volume,
                    loop=al.loop,
                    fade_in=al.fade_in,
                    fade_out=al.fade_out,
                    order_num=al.order_num,
                )
            )

    def _copy_exposure(old_se: models.SceneExposure, *, location_id: UUID | None, story_beat_id: UUID | None):
        new_id = id_map.register(old_se.id)
        new_se = models.SceneExposure(
            id=new_id,
            source_entity_id=old_se.id,
            name=old_se.name,
            order_num=old_se.order_num,
            tags=copy.deepcopy(old_se.tags) if old_se.tags else None,
            scenario_id=new_sid,
            location_id=location_id,
            story_beat_id=story_beat_id,
        )
        db.add(new_se)
        exposure_by_old[old_se.id] = new_se
        return new_se

    for old_loc in src.locations or []:
        for old_se in old_loc.scene_exposures or []:
            new_se = _copy_exposure(old_se, location_id=id_map.remap(old_loc.id), story_beat_id=None)
            await db.flush()
            await _copy_exposure_m2m(old_se, new_se.id)
            _copy_exposure_links(old_se, new_se.id)

    for old_sb in src.story_beats or []:
        for old_se in old_sb.scene_exposures or []:
            new_se = _copy_exposure(old_se, location_id=None, story_beat_id=id_map.remap(old_sb.id))
            await db.flush()
            await _copy_exposure_m2m(old_se, new_se.id)
            _copy_exposure_links(old_se, new_se.id)

    await db.flush()

    # template set links
    for link in src.entity_pack_links or []:
        db.add(
            models.ScenarioEntityPackLink(
                scenario_id=new_sid,
                pack_id=link.pack_id,
                enabled=link.enabled,
                order_num=link.order_num,
                tags=copy.deepcopy(link.tags) if link.tags else None,
            )
        )

    for link in src.name_pack_links or []:
        db.add(
            models.ScenarioNamePackLink(
                scenario_id=new_sid,
                name_pack_id=link.name_pack_id,
                enabled=link.enabled,
                order_num=link.order_num,
            )
        )

    # todos — remap element_id when mapped
    for todo in src.todos or []:
        new_element_id = id_map.remap(todo.element_id) if todo.element_id else None
        db.add(
            models.ScenarioTodo(
                source_entity_id=todo.id,
                **_copy_scalar_columns(
                    todo,
                    models.ScenarioTodo,
                    exclude=frozenset({"scenario_id", "element_id"}),
                    rule_id_str=clone_rule_id,
                ),
                scenario_id=new_sid,
                element_id=new_element_id,
            )
        )

    # scenario tags + fronts (tag first, then front, then link front_id / members / wiki)
    tag_by_old: dict[UUID, models.ScenarioTag] = {}
    for old_tag in src.scenario_tags or []:
        new_tag_id = id_map.register(old_tag.id)
        new_tag = models.ScenarioTag(
            id=new_tag_id,
            scenario_id=new_sid,
            key=old_tag.key,
            label=old_tag.label,
            description=old_tag.description,
            color=old_tag.color,
            kind=old_tag.kind,
            front_id=None,
        )
        db.add(new_tag)
        tag_by_old[old_tag.id] = new_tag
    await db.flush()

    front_by_old: dict[UUID, models.Front] = {}
    for old_front in src.fronts or []:
        new_front_id = id_map.register(old_front.id)
        new_tag_id = id_map.remap(old_front.tag_id)
        if new_tag_id is None:
            continue
        new_front = models.Front(
            id=new_front_id,
            scenario_id=new_sid,
            name=old_front.name,
            description_for_master=old_front.description_for_master,
            color=old_front.color,
            icon_url=old_front.icon_url,
            tag_id=new_tag_id,
        )
        db.add(new_front)
        front_by_old[old_front.id] = new_front
    await db.flush()

    for old_tag in src.scenario_tags or []:
        new_tag = tag_by_old.get(old_tag.id)
        if not new_tag or not old_tag.front_id:
            continue
        new_tag.front_id = id_map.remap(old_tag.front_id)

    for old_front in src.fronts or []:
        new_front = front_by_old.get(old_front.id)
        if not new_front:
            continue
        for m in old_front.members or []:
            new_entity_id = id_map.remap(m.entity_id)
            if new_entity_id is None:
                continue
            db.add(
                models.FrontMember(
                    front_id=new_front.id,
                    entity_type=m.entity_type,
                    entity_id=new_entity_id,
                )
            )
        for w in old_front.wiki_notes or []:
            new_note_id = id_map.remap(w.note_id)
            if new_note_id is None:
                continue
            db.add(
                models.FrontWikiNote(
                    front_id=new_front.id,
                    note_id=new_note_id,
                    sort_order=w.sort_order or 0,
                )
            )

    await db.flush()
    await db.refresh(new_scenario)

    return CloneResult(scenario=new_scenario, id_map=dict(id_map._m))


async def clone_scenario_for_session(
    db: AsyncSession,
    *,
    source_scenario_id: UUID,
    session_name: str,
    application_characters: list[models.CharacterApplication] | None = None,
) -> CloneResult:
    """Create an isolated scenario copy for a game session."""
    src: models.Scenario | None = await db.get(models.Scenario, source_scenario_id)
    if not src:
        raise ValueError(f"scenario not found: {source_scenario_id}")

    return await _clone_scenario(
        db,
        source_scenario_id=source_scenario_id,
        new_name=session_name or src.name,
        owner_user_id=src.user_id,
        is_session_snapshot=True,
        application_characters=application_characters,
    )


async def duplicate_scenario_for_user(
    db: AsyncSession,
    *,
    source_scenario_id: UUID,
    owner_user_id: UUID,
    new_name: str | None = None,
) -> CloneResult:
    """Create a master-editable copy of a scenario owned by the given user."""
    src: models.Scenario | None = await db.get(models.Scenario, source_scenario_id)
    if not src:
        raise ValueError(f"scenario not found: {source_scenario_id}")

    copy_name = new_name or f"{src.name} (копия)"
    result = await _clone_scenario(
        db,
        source_scenario_id=source_scenario_id,
        new_name=copy_name,
        owner_user_id=owner_user_id,
        is_session_snapshot=False,
    )

    template_id_map = await _copy_owned_template_sets(
        db,
        source_scenario_id=source_scenario_id,
        target_scenario_id=result.scenario.id,
    )
    await _remap_exposure_template_links(
        db,
        scenario_id=result.scenario.id,
        template_id_map=template_id_map,
    )
    await db.refresh(result.scenario)
    return result
