"""Load scenario entities from PostgreSQL for session WS payloads."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.managers._helper import dump_locations_with_exposition, dump_story_beats_with_exposition, _convert_exposure
from app.services.scenario_cloner import _scenario_load_stmt


@dataclass
class ScenarioEntitiesSnapshot:
    scenario: models.Scenario | None = None
    locations: list[scheme.InnerLocation] = field(default_factory=list)
    story_beats: list[scheme.InnerStroyBeat] = field(default_factory=list)
    characters: list[scheme.InnerCharacter] = field(default_factory=list)
    npcs: list[scheme.InnerNPC] = field(default_factory=list)
    items: list[scheme.InnerFreeGameItem] = field(default_factory=list)
    notes: list[scheme.InnerNote] = field(default_factory=list)
    counters: list[scheme.InnerCounter] = field(default_factory=list)
    audio: list[scheme.AudioTrackOut] = field(default_factory=list)
    factories: list[scheme.Factory] = field(default_factory=list)
    todos: list[scheme.ScenarioTodoOut] = field(default_factory=list)
    obstacles: list[scheme.ObstacleOut] = field(default_factory=list)
    polygon_shown: set[UUID] = field(default_factory=set)

    def as_inner_scenario_fields(self, scenario: models.Scenario | None = None) -> dict[str, Any]:
        sc = scenario or self.scenario
        if not sc:
            raise ValueError("scenario required")
        return {
            "scenario_starts_at": sc.scenario_starts_at,
            "name": sc.name,
            "intro": sc.intro,
            "user": sc.user,
            "max_players": sc.max_players,
            "rule_id_str": sc.rule_id_str,
            "icon_url": sc.icon_url,
            "data": sc.data or {},
            "locations": self.locations,
            "story_beats": self.story_beats,
            "characters": self.characters,
            "npcs": self.npcs,
            "items": self.items,
            "notes": self.notes,
            "counters": self.counters,
            "audio": self.audio,
            "factories": self.factories,
            "seen": set(),
            "polygon_shown": self.polygon_shown,
        }


class SessionEntityLoader:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[UUID, ScenarioEntitiesSnapshot] = {}

    async def load_snapshot(self, scenario_id: UUID, *, use_cache: bool = True) -> ScenarioEntitiesSnapshot:
        if use_cache and scenario_id in self._cache:
            return self._cache[scenario_id]

        scenario: models.Scenario | None = (
            await self.db.execute(_scenario_load_stmt(scenario_id))
        ).scalars().first()
        if not scenario:
            raise ValueError(f"scenario not found: {scenario_id}")

        from app.managers._helper import _collect_audio_tracks, _convert_exposure, _convert_character, _free_items, _visible_polygon_ids
        from app.managers.fabric_helpers import build_factories_payload_for_scenario

        all_raw_audios: list[dict] = []
        locations_data = dump_locations_with_exposition(scenario.locations or [])
        for loc in scenario.locations or []:
            for se in loc.scene_exposures or []:
                _, raw_audios = _convert_exposure(se)
                all_raw_audios.extend(raw_audios)

        story_beats_data = dump_story_beats_with_exposition(scenario.story_beats or [])
        for sb in scenario.story_beats or []:
            for se in sb.scene_exposures or []:
                _, raw_audios = _convert_exposure(se)
                all_raw_audios.extend(raw_audios)

        audio_tracks = _collect_audio_tracks(all_raw_audios)

        factories_payload = await build_factories_payload_for_scenario(self.db, scenario_id)

        locations = [scheme.InnerLocation.model_validate(d) for d in locations_data]
        story_beats = [scheme.InnerStroyBeat.model_validate(d) for d in story_beats_data]

        npcs = [
            scheme.InnerNPC.model_validate(
                scheme.NPCOut.model_validate(n).model_dump(mode="python")
            )
            for n in (scenario.npcs or [])
        ]

        free_items = _free_items(scenario.items or [])
        items = [
            scheme.InnerFreeGameItem.model_validate(
                scheme.GameItemOut.model_validate(it).model_dump(mode="python")
            )
            for it in free_items
        ]

        characters = [
            scheme.InnerCharacter.model_validate(_convert_character(ch))
            for ch in (scenario.characters or [])
        ]

        notes = [scheme.InnerNote.model_validate(n) for n in (scenario.notes or [])]
        counters = [scheme.InnerCounter.model_validate(c) for c in (scenario.counters or [])]
        obstacles = [scheme.ObstacleOut.model_validate(o) for o in (scenario.obstacles or [])]

        todos_rows = (
            await self.db.execute(
                select(models.ScenarioTodo).where(models.ScenarioTodo.scenario_id == scenario_id)
            )
        ).scalars().all()
        todos = [scheme.ScenarioTodoOut.model_validate(t) for t in todos_rows]

        snapshot = ScenarioEntitiesSnapshot(
            scenario=scenario,
            locations=locations,
            story_beats=story_beats,
            characters=characters,
            npcs=npcs,
            items=items,
            notes=notes,
            counters=counters,
            audio=[scheme.AudioTrackOut.model_validate(t) for t in audio_tracks],
            factories=[scheme.Factory.model_validate(f) for f in factories_payload],
            todos=todos,
            obstacles=obstacles,
            polygon_shown=_visible_polygon_ids(locations),
        )
        self._cache[scenario_id] = snapshot
        return snapshot

    def invalidate(self, scenario_id: UUID) -> None:
        self._cache.pop(scenario_id, None)
