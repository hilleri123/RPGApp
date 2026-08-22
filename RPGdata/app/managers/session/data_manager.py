from __future__ import annotations

from uuid import UUID

from plugins.common.types import ValidateResult
from redis.commands.json.path import Path
from typing import Any, Dict, Optional

from redis.exceptions import ResponseError
from sqlalchemy import select
from app.infrastructure.redis_service import redis_client
from app.infrastructure.database import AsyncSessionLocal
from app.plugins.registry_singleton import registry
from app.logger import logger
from app import scheme, models
from app.scheme.session.runtime import SessionRuntimeState
from app.managers.session.entity_loader import SessionEntityLoader, ScenarioEntitiesSnapshot

SESSION_KEY_PREFIX = "session"
LAUNCHED_KEY_PREFIX = "launched"

_RUNTIME_FIELDS = frozenset(SessionRuntimeState.model_fields.keys())

# Поля сессии, у которых есть своя таблица: правки из сессии нужно писать в
# Postgres, иначе они исчезают на следующем get_inner().
_PERSISTED_ENTITY_MODELS: dict[str, Any] = {
    "npcs": models.NPC,
    "characters": models.PlayerCharacter,
    "items": models.GameItem,
    "locations": models.Location,
    "obstacles": models.Obstacle,
    "notes": models.Note,
    "story_beats": models.StoryBeat,
}

# Производные и рантайм-поля без своей таблицы: писать их некуда, но и делать
# вид, что запись прошла, нельзя.
_UNBACKED_ENTITY_FIELDS = frozenset({"counters", "todos", "audio", "factories"})


class SessionDataManager:
    def __init__(self, session_id: str, launched_scenario_id: str | None = None):
        self.session_id = session_id
        self.launched_scenario_id = launched_scenario_id
        self._entity_cache: dict[UUID, ScenarioEntitiesSnapshot] = {}

    def _session_key(self) -> str:
        if self.launched_scenario_id:
            return f"{LAUNCHED_KEY_PREFIX}:{self.launched_scenario_id}"
        return f"{SESSION_KEY_PREFIX}:{self.session_id}"

    def _m_path(self, field: str) -> Path:
        assert field in _RUNTIME_FIELDS, f"Поле {field} отсутствует в SessionRuntimeState"
        return Path(f".{field}")

    def _get_rules_factory(self, runtime: SessionRuntimeState):
        plugin = registry.get(runtime.rule_id_str)
        if not plugin:
            raise RuntimeError(f"rules plugin not found: {runtime.rule_id_str}")
        return plugin.get_factory()

    async def session_exists(self) -> bool:
        return await redis_client.exists(self._session_key()) == 1

    async def delete_session(self) -> None:
        await redis_client.delete(self._session_key())

    async def get_runtime(self) -> SessionRuntimeState:
        data = await redis_client.json().get(self._session_key())
        if not data:
            raise ValueError(f"session not found in redis: {self.session_id}")
        return SessionRuntimeState.model_validate(data)

    async def set_runtime(self, runtime: SessionRuntimeState) -> None:
        await redis_client.json().set(
            self._session_key(),
            Path.root_path(),
            runtime.model_dump(mode="json"),
        )

    async def _load_entities(self, scenario_id: UUID) -> ScenarioEntitiesSnapshot:
        cached = self._entity_cache.get(scenario_id)
        if cached is not None:
            return cached

        async with AsyncSessionLocal() as db:
            entities = await SessionEntityLoader(db).load_snapshot(scenario_id, use_cache=False)

        self._entity_cache[scenario_id] = entities
        return entities

    async def invalidate_entity_cache(self) -> None:
        runtime = await self.get_runtime()
        self._entity_cache.pop(runtime.scenario_id, None)

    async def get_inner(self) -> scheme.GameSessionInner:
        """View-model: runtime from Redis + entities from PostgreSQL."""
        runtime = await self.get_runtime()
        entities = await self._load_entities(runtime.scenario_id)

        polygon_shown = runtime.polygon_shown or entities.polygon_shown
        scenario_fields = entities.as_inner_scenario_fields()
        scenario_fields.pop("id", None)

        return scheme.GameSessionInner.model_validate({
            **runtime.model_dump(mode="json"),
            **scenario_fields,
            "polygon_shown": polygon_shown,
            "todos": entities.todos,
            "obstacles": entities.obstacles,
        })

    async def set_inner(self, inner: scheme.GameSessionInner) -> None:
        """Persist only runtime fields to Redis."""
        runtime = SessionRuntimeState.model_validate(inner.model_dump(mode="json"))
        await self.set_runtime(runtime)

    async def get_scenario_id(self):
        runtime = await self.get_runtime()
        return runtime.scenario_id

    async def get_field(self, field: str) -> Any:
        if field in _RUNTIME_FIELDS:
            try:
                return await redis_client.json().get(self._session_key(), self._m_path(field))
            except ResponseError as exc:
                if "does not exist" not in str(exc):
                    raise
                runtime = await self.get_runtime()
                return getattr(runtime, field)
        inner = await self.get_inner()
        return getattr(inner, field)

    async def set_field(self, field: str, value: Any) -> None:
        if field not in _RUNTIME_FIELDS:
            # Entity fields live in Postgres (not Redis). Session patches / WS
            # updates must write data+tags back or HP/resource changes are lost
            # on the next get_inner() reload.
            if field in _PERSISTED_ENTITY_MODELS:
                if value is not None:
                    await self._persist_entity_list_to_db(field, value)
                await self.invalidate_entity_cache()
            elif field in _UNBACKED_ENTITY_FIELDS:
                # Записывать некуда — у поля нет своей таблицы. Молчать здесь
                # нельзя: правка выглядит применённой до ближайшего get_inner(),
                # а потом бесследно исчезает.
                logger.warning(
                    "set_field: поле %s не имеет хранилища, запись потеряна session=%s",
                    field,
                    self.session_id,
                )
                await self.invalidate_entity_cache()
            return
        await redis_client.json().set(self._session_key(), self._m_path(field), value)

    async def _persist_entity_list_to_db(self, field: str, value: Any) -> None:
        """Write session-mutated entity data/tags to PostgreSQL."""
        items = value if isinstance(value, list) else []
        if not items:
            return

        model = _PERSISTED_ENTITY_MODELS.get(field)
        if model is None:
            return

        by_id: dict[UUID, dict] = {}
        for raw in items:
            if hasattr(raw, "model_dump"):
                raw = raw.model_dump(mode="json")
            if not isinstance(raw, dict):
                continue
            eid = raw.get("id")
            if not eid:
                continue
            try:
                by_id[UUID(str(eid))] = raw
            except ValueError:
                logger.warning("malformed entity id field=%s id=%r", field, eid)
        if not by_id:
            return

        scenario_id = await self.get_scenario_id()

        updated = 0
        async with AsyncSessionLocal() as db:
            # Only entities of this session's scenario may be written: the list
            # originates from the client payload and may reference foreign ids.
            rows = (await db.execute(
                select(model).where(
                    model.id.in_(by_id.keys()),
                    model.scenario_id == scenario_id,
                )
            )).scalars().all()

            rejected = set(by_id) - {row.id for row in rows}
            if rejected:
                logger.warning(
                    "rejected %s foreign entity ids field=%s session=%s scenario=%s ids=%s",
                    len(rejected),
                    field,
                    self.session_id,
                    scenario_id,
                    sorted(str(i) for i in rejected),
                )

            # У части сущностей (заметки, вехи) нет колонки data — присваивание
            # создало бы обычный питоновский атрибут, и запись снова потерялась бы.
            columns = {c.name for c in model.__table__.columns}

            for obj in rows:
                raw = by_id[obj.id]
                if "data" in raw and raw["data"] is not None and "data" in columns:
                    obj.data = raw["data"]
                if "tags" in raw and raw["tags"] is not None and "tags" in columns:
                    obj.tags = list(raw["tags"] or [])
                updated += 1
            if updated:
                await db.commit()
                logger.info(
                    "persisted %s entity field=%s session=%s",
                    updated,
                    field,
                    self.session_id,
                )

    async def get_scenes(self):
        return await self.get_field("scenes")

    async def set_scenes(self, scenes_value):
        if hasattr(scenes_value, "model_dump"):
            scenes_value = scenes_value.model_dump(mode="json")
        await self.set_field("scenes", scenes_value)

    async def add_log(self, log: scheme.LogUnion) -> None:
        logs = await self.get_field("logs") or []
        logs.append(log.model_dump(mode="json"))
        await self.set_field("logs", logs)

    async def add_notification(self, notif: scheme.NotificationUnion) -> None:
        notifications = await self.get_field("notifications") or []
        notifications.append(notif.model_dump(mode="json"))
        await self.set_field("notifications", notifications)

    async def persist_seen_delta(self, new_ids: set[UUID]) -> None:
        if not new_ids:
            return
        if self.launched_scenario_id:
            from app.services.player_seen_service import add_seen_for_users

            inner = await self.get_inner()
            async with AsyncSessionLocal() as db:
                user_ids = await self._approach_user_ids()
                await add_seen_for_users(
                    db,
                    launched_scenario_id=UUID(self.launched_scenario_id),
                    user_ids=user_ids,
                    seen_ids=new_ids,
                    inner=inner,
                )
                await db.commit()
            return

        inner = await self.get_inner()
        from app.services.entity_seen import resolve_seen_entries_from_inner

        entries = resolve_seen_entries_from_inner(inner, new_ids)
        inner.seen.update(entry[1] for entry in entries)
        await self.set_field("seen", [str(x) for x in inner.seen])

    async def persist_polygon_shown(self, polygon_ids: set[UUID]) -> None:
        if self.launched_scenario_id:
            from app.services.player_seen_service import add_seen_for_users

            async with AsyncSessionLocal() as db:
                user_ids = await self._approach_user_ids()
                await add_seen_for_users(
                    db,
                    launched_scenario_id=UUID(self.launched_scenario_id),
                    user_ids=user_ids,
                    polygon_shown_ids=polygon_ids,
                )
                await db.commit()
        await self.set_field("polygon_shown", [str(x) for x in polygon_ids])

    async def _approach_user_ids(self) -> list[UUID]:
        inner = await self.get_inner()
        ids: list[UUID] = []
        for p in inner.players or []:
            uid = getattr(getattr(p, "user", None), "id", None)
            if uid:
                ids.append(UUID(str(uid)))
        return ids

    async def get_player_seen_sets(
        self, user_id: UUID
    ) -> tuple[set[UUID], set[UUID], list]:
        if self.launched_scenario_id:
            from app.services.player_seen_service import get_player_seen

            async with AsyncSessionLocal() as db:
                return await get_player_seen(
                    db,
                    launched_scenario_id=UUID(self.launched_scenario_id),
                    user_id=user_id,
                )
        inner = await self.get_inner()
        return set(inner.seen or []), set(inner.polygon_shown or []), []

    async def get_party_filter_tags(self) -> list[str]:
        runtime = await self.get_runtime()
        party_id = runtime.party_id
        if not party_id:
            return []
        async with AsyncSessionLocal() as db:
            party = await db.get(models.ScenarioParty, party_id)
            return list(party.filter_tags or []) if party else []

    async def validate_data(self, entity: str, data: dict[str, Any], tags: list[str], context: dict[str, Any]):
        runtime = await self.get_runtime()
        plugin = registry.get(runtime.rule_id_str)
        factory = plugin.get_factory()
        payload = {
            "data": data,
            "tags": tags
        }
        res = factory.handle(kind="validate", entity=entity, payload=payload, context=context)
        res = ValidateResult.model_validate(res)

        return res.ok, res.issues, res.result.data, res.result.tags
