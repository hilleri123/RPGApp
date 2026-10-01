from __future__ import annotations

import io
import json
import traceback
from uuid import UUID, uuid4
from typing import Any, Tuple
from datetime import datetime, timezone

from fastapi import UploadFile
from sqlalchemy import select

from app.logger import logger
from app import models, scheme
from app.constants.location_kinds import with_kind
from .todo_manager import SessionTODOManager
from app.infrastructure.database import get_async_session as get_db
from app.routes.locations import create_location, update_location


def _make_upload_file(data: bytes, filename: str, content_type: str) -> UploadFile:
    return UploadFile(
        filename=filename,
        content_type=content_type,
        file=io.BytesIO(data),
    )


class SessionLocationManager(SessionTODOManager):
    def __init__(self, session_id: UUID):
        super().__init__(str(session_id))

    # ── error tracking ────────────────────────────────────────────────────────

    async def _push_error(self, context: str, exc: Exception) -> None:
        tb = traceback.format_exc()
        # сразу dict, не Pydantic-объект
        entry = {
            "id":          str(uuid4()),
            "context":     context,
            "error":       type(exc).__name__,
            "message":     str(exc),
            "traceback":   tb,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        }
        logger.error(f"[{context}] {type(exc).__name__}: {exc}\n{tb}")

        inner = await self.get_inner()
        # inner.errors может содержать SessionErrorEntry объекты — сериализуем
        errors = [
            e.model_dump() if hasattr(e, "model_dump") else e
            for e in (getattr(inner, "errors", None) or [])
        ]
        errors = (errors + [entry])[-50:]
        await self.set_field("errors", errors)

    # ── helpers ───────────────────────────────────────────────────────────────

    async def _settings_allow_edit(self) -> bool:
        inner = await self.get_inner()
        settings = getattr(inner, "settings", None)
        if not settings:
            return False
        if isinstance(settings, dict):
            return bool(settings.get("edit_scenario", False))
        return bool(getattr(settings, "edit_scenario", False))

    def _wrap_to_upsert_payload(self, raw: dict) -> dict:
        entity_field_names = {
            "id", "name", "description_for_master", "description_for_players",
            "parent_location_id", "is_start", "icon_url", "map_url",
            "map_width", "map_height",
            "excalidraw_map_json", "tags",
        }
        # чистим map_objects — убираем невалидные source_location_id
        location_id = raw.get("id")
        clean_map_objects = []
        for obj in (raw.get("map_objects") or []):
            if isinstance(obj, dict):
                if not obj.get("source_location_id"):
                    obj = {**obj, "source_location_id": str(location_id) if location_id else str(uuid4())}
                clean_map_objects.append(obj)
            else:
                # MapObjectPolygon — сериализуем
                clean_map_objects.append(
                    obj.model_dump(mode="json") if hasattr(obj, "model_dump") else obj
                )

        return {
            "force":           raw.get("force", False),
            "data":            raw.get("data", {}),
            **{k: v for k, v in raw.items() if k in entity_field_names},
            "map_objects":     clean_map_objects,
            "sublocations":    raw.get("sublocations", []),
            "scene_exposures": raw.get("scene_exposures", []),
        }

    # ── polygon visibility ────────────────────────────────────────────────────

    async def change_polygon_visibility(
        self,
        location_id: UUID,
        polygon_id: UUID,
        is_visible: bool,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        if is_visible:
            inner.polygon_shown.add(polygon_id)
        else:
            inner.polygon_shown.discard(polygon_id)
        await self.persist_polygon_shown(set(inner.polygon_shown))
        return True, ["polygon_shown"]

    # ── sublocations sync (Redis) ─────────────────────────────────────────────

    def _sync_sublocations_in_memory(
        self,
        locations: list[scheme.LocationOut],
        parent_id: UUID,
        sublocations: list[scheme.SubLocationRef],
    ) -> Tuple[list[scheme.LocationOut], list[scheme.SubLocationRef], list[scheme.LocationOut]]:
        """
        Возвращает (обновлённый список локаций, созданные подлокации, отвязанные подлокации).
        Новым подлокациям сразу назначает UUID — чтобы не было рассинхрона с БД.
        """

        parent_id_str = str(parent_id)
        payload_ids_str = {str(s.id) for s in sublocations if s.id}
        existing_loc_ids = {str(loc.id) for loc in locations}

        created: list[scheme.SubLocationRef] = []
        detached: list[scheme.LocationOut] = []
        result: list[scheme.LocationOut] = list(locations)  # копируем

        # отвязываем удалённые
        result = []
        for loc in locations:
            loc_parent_str = str(loc.parent_location_id) if loc.parent_location_id else None
            loc_id_str = str(loc.id)

            if loc_parent_str == parent_id_str and loc_id_str not in payload_ids_str:
                detached.append(loc)
                result.append(loc.model_copy(update={"parent_location_id": None}))
            elif loc_id_str in payload_ids_str:
                sub = next((s for s in sublocations if str(s.id) == loc_id_str), None)
                changes: dict = {}
                if sub and sub.name != loc.name:
                    changes["name"] = sub.name
                if sub and "kind" in sub.model_fields_set:
                    new_tags = with_kind(loc.tags, sub.kind)
                    if new_tags != list(loc.tags or []):
                        changes["tags"] = new_tags
                result.append(loc.model_copy(update=changes) if changes else loc)
            else:
                result.append(loc)

        # создаём новые — те у кого id есть, но их нет в locations
        for sub in sublocations:
            sub_id_str = str(sub.id) if sub.id else None
            if sub_id_str and sub_id_str not in existing_loc_ids:
                # ← ключевое изменение: sub.id есть, но локации нет → создаём
                new_loc = scheme.LocationOut(
                    id=sub.id,
                    name=sub.name,
                    description_for_master="",
                    description_for_players="",
                    parent_location_id=parent_id,
                    tags=with_kind([], sub.kind),
                )
                result.append(new_loc)
                created.append(scheme.SubLocationRef(id=sub.id, name=sub.name))
            elif not sub_id_str:
                # старый путь — id не было совсем
                new_id = uuid4()
                new_loc = scheme.LocationOut(
                    id=new_id,
                    name=sub.name,
                    description_for_master="",
                    description_for_players="",
                    parent_location_id=parent_id,
                    tags=with_kind([], sub.kind),
                )
                result.append(new_loc)
                created.append(scheme.SubLocationRef(id=new_id, name=sub.name))

        return result, created, detached

    # ── redis upsert ──────────────────────────────────────────────────────────

    async def _upsert_location_in_redis(
        self, location_out: scheme.LocationOut
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        existing_ids = {loc.id for loc in (inner.locations or [])}
        if location_out.id not in existing_ids:
            inner.locations.append(location_out)
        else:
            inner.locations = [
                location_out if loc.id == location_out.id else loc
                for loc in inner.locations
            ]
        await self.set_field(
            "locations",
            [loc.model_dump(mode="json") for loc in inner.locations],
        )
        return True, ["locations"]

    # ── TODO из диффа подлокаций ──────────────────────────────────────────────

    async def _emit_sublocation_todos(
        self,
        current_user: models.User,
        parent: scheme.LocationOut,
        created: list[scheme.SubLocationRef],
        detached: list[scheme.LocationOut],
    ) -> None:
        """Единый метод для create и update — пишет TODO по диффу подлокаций."""
        inner = await self.get_inner()
        game_label = f"игры '{inner.name}' мастером '{inner.master.full_name}'"

        for sub in created:
            await self.add_todo(
                user=current_user,
                text=f"Подлокация '{sub.name}' создана в локации '{parent.name}' при ведении {game_label}",
                note=None,
                priority="low",
                element_type=models.TodoElementType.location,
                element_id=sub.id,
                element_name=sub.name,
            )

        for loc in detached:
            await self.add_todo(
                user=current_user,
                text=f"Подлокация '{loc.name}' отвязана от '{parent.name}' при ведении {game_label}",
                note=None,
                priority="low",
                element_type=models.TodoElementType.location,
                element_id=loc.id,
                element_name=loc.name,
            )

    # ── create location ───────────────────────────────────────────────────────

    async def create_location(
        self,
        current_user: models.User,
        payload: Any,
        map_bytes: bytes = None,
        icon_bytes: bytes = None,
    ) -> Tuple[bool, list[str]]:
        raw = payload if isinstance(payload, dict) else payload.model_dump()
        loc_id = raw.get("id") or uuid4()
        map_objects = self._parse_map_objects(raw.get("map_objects"), loc_id)
        new_location = scheme.LocationOut(**{**raw, "id": loc_id, "map_objects": map_objects})

        # ── 1. БД ─────────────────────────────────────────────────────────────
        inner = await self.get_inner()
        try:
            await self._persist_create_to_db(
                current_user, inner.scenario_id, raw, new_location, map_bytes, icon_bytes
            )
        except Exception as exc:
            await self._push_error("create_location:db", exc)
            return False, []

        await self.invalidate_entity_cache()

        sublocations_raw = raw.get("sublocations") or []
        created_subs = [
            scheme.SubLocationRef(**s) if isinstance(s, dict) else s
            for s in sublocations_raw
        ]
        detached_subs: list[scheme.LocationOut] = []

        # ── 2. TODO ───────────────────────────────────────────────────────────
        await self.add_location_todo(current_user, new_location, created=True)
        await self._emit_sublocation_todos(current_user, new_location, created_subs, detached_subs)

        return True, ["locations"]
    
    def _parse_map_objects(
        self, raw_list: list, location_id: Any
    ) -> list[scheme.MapObjectPolygon]:
        result = []
        for s in (raw_list or []):
            if isinstance(s, dict):
                if not s.get("id"):
                    s = {**s, "id": uuid4()}
                if not s.get("source_location_id"):
                    s = {**s, "source_location_id": str(location_id)}
                try:
                    result.append(scheme.MapObjectPolygon(**s))
                except Exception as e:
                    logger.warning(f"skipping invalid map_object: {e} | data: {s}")
            else:
                result.append(s)
        return result

    async def _apply_create_to_redis(
        self, raw: dict
    ) -> Tuple[bool, scheme.LocationOut, list[scheme.SubLocationRef], list[scheme.LocationOut]]:
        inner = await self.get_inner()

        new_id = raw.get("id") or uuid4()

        sublocations_raw = raw.get("sublocations") or []
        sublocations = [
            scheme.SubLocationRef(**s) if isinstance(s, dict) else s
            for s in sublocations_raw
        ]

        map_objects = self._parse_map_objects(raw.get("map_objects"), new_id)

        new_location = scheme.LocationOut(
            **{**raw, "id": new_id, "map_objects": map_objects}
        )

        existing_ids = {loc.id for loc in (inner.locations or [])}
        if new_location.id in existing_ids:
            return False, new_location, [], []

        inner.locations.append(new_location)

        created_subs: list[scheme.SubLocationRef] = []
        detached_subs: list[scheme.LocationOut] = []
        if sublocations:
            inner.locations, created_subs, detached_subs = self._sync_sublocations_in_memory(
                inner.locations, new_location.id, sublocations
            )

        await self.set_field(
            "locations",
            [loc.model_dump(mode="json") for loc in inner.locations],
        )
        return True, new_location, created_subs, detached_subs

    async def _persist_create_to_db(
        self,
        current_user: models.User,
        scenario_id: UUID,
        raw: dict,
        redis_location: scheme.LocationOut,
        map_bytes: bytes,
        icon_bytes: bytes,
    ) -> None:
        """Записывает локацию в БД, используя тот же UUID что уже в Redis."""
        upsert_raw = self._wrap_to_upsert_payload(raw)
        # передаём id чтобы БД использовала тот же UUID
        upsert_raw["id"] = str(redis_location.id)

        # подлокациям тоже проставляем UUID из Redis
        inner = await self.get_inner()
        redis_subs = {
            loc.name: str(loc.id)
            for loc in inner.locations
            if loc.parent_location_id == redis_location.id
        }
        for sub in upsert_raw["sublocations"]:
            if not sub.get("id") and sub.get("name") in redis_subs:
                sub["id"] = redis_subs[sub["name"]]

        map_file  = _make_upload_file(map_bytes,  "map.png",  "image/png") if map_bytes  else None
        icon_file = _make_upload_file(icon_bytes, "icon.png", "image/png") if icon_bytes else None

        async for db in get_db():
            scenario = (await db.execute(
                select(models.Scenario).where(models.Scenario.id == scenario_id)
            )).scalars().first()
            if not scenario:
                return

            await create_location(
                data=json.dumps(upsert_raw),
                icon_file=icon_file,
                map_file=map_file,
                scenario=scenario,
                current_user=current_user,
                db=db,
            )

    # ── update location ───────────────────────────────────────────────────────

    async def update_location(
        self,
        current_user: models.User,
        payload: Any,
        map_bytes: bytes = None,
        icon_bytes: bytes = None,
    ) -> Tuple[bool, list[str]]:
        raw = payload if isinstance(payload, dict) else payload.model_dump()

        location_id = raw.get("id")
        map_objects = self._parse_map_objects(raw.get("map_objects"), location_id)
        updated_location = scheme.LocationOut(**{**raw, "map_objects": map_objects})
        if not updated_location.id:
            return False, []

        sublocations_raw = raw.get("sublocations") or []
        created_subs = [
            scheme.SubLocationRef(**s) if isinstance(s, dict) else s
            for s in sublocations_raw
        ]
        detached_subs: list[scheme.LocationOut] = []

        inner = await self.get_inner()
        try:
            await self._persist_update_to_db(
                current_user, inner.scenario_id, raw, updated_location,
                created_subs, map_bytes, icon_bytes
            )
        except Exception as exc:
            await self._push_error("update_location:db", exc)
            return False, []

        await self.invalidate_entity_cache()

        await self.add_location_todo(current_user, updated_location, created=False)
        await self._emit_sublocation_todos(current_user, updated_location, created_subs, detached_subs)

        return True, ["locations"]

    async def _apply_update_to_redis(
        self, raw: dict
    ) -> Tuple[bool, scheme.LocationOut, list[scheme.SubLocationRef], list[scheme.LocationOut]]:
        inner = await self.get_inner()

        sublocations_raw = raw.get("sublocations") or []
        sublocations = [
            scheme.SubLocationRef(**s) if isinstance(s, dict) else s
            for s in sublocations_raw
        ]

        location_id = raw.get("id")
        map_objects = self._parse_map_objects(raw.get("map_objects"), location_id)

        new_location = scheme.LocationOut(**{**raw, "map_objects": map_objects})

        if not new_location.id:
            logger.warning("_apply_update_to_redis: missing location.id")
            return False, new_location, [], []

        updated = False
        new_locations = []
        for loc in (inner.locations or []):
            if loc.id == new_location.id:
                new_locations.append(new_location)
                updated = True
            else:
                new_locations.append(loc)

        if not updated:
            return False, new_location, [], []

        inner.locations = new_locations

        created_subs: list[scheme.SubLocationRef] = []
        detached_subs: list[scheme.LocationOut] = []
        if sublocations is not None:
            inner.locations, created_subs, detached_subs = self._sync_sublocations_in_memory(
                inner.locations, new_location.id, sublocations
            )

        await self.set_field(
            "locations",
            [loc.model_dump(mode="json") for loc in inner.locations],
        )
        return True, new_location, created_subs, detached_subs

    async def _persist_update_to_db(
        self,
        current_user: models.User,
        scenario_id: UUID,
        raw: dict,
        redis_location: scheme.LocationOut,
        created_subs: list[scheme.SubLocationRef],
        map_bytes: bytes,
        icon_bytes: bytes,
    ) -> None:
        upsert_raw = self._wrap_to_upsert_payload(raw)

        inner = await self.get_inner()
        redis_children = [
            loc for loc in (inner.locations or [])
            if loc.parent_location_id == redis_location.id
        ]
        upsert_raw["sublocations"] = [
            {"id": str(loc.id), "name": loc.name}
            for loc in redis_children
        ]

        map_file  = _make_upload_file(map_bytes,  "map.png",  "image/png") if map_bytes  else None
        icon_file = _make_upload_file(icon_bytes, "icon.png", "image/png") if icon_bytes else None

        async for db in get_db():
            scenario = (await db.execute(
                select(models.Scenario).where(models.Scenario.id == scenario_id)
            )).scalars().first()
            if not scenario:
                return

            # ← НОВОЕ: сначала создаём новые подлокации в БД
            # чтобы FK constraint на target_location_id не упал
            for sub_ref in created_subs:
                sub_loc = next(
                    (l for l in redis_children if l.id == sub_ref.id), None
                )
                if not sub_loc:
                    continue
                existing = (await db.execute(
                    select(models.Location).where(models.Location.id == sub_loc.id)
                )).scalars().first()
                if not existing:
                    sub_upsert = self._wrap_to_upsert_payload({
                        "id": str(sub_loc.id),
                        "name": sub_loc.name,
                        "parent_location_id": str(redis_location.id),
                        "description_for_master": "",
                        "description_for_players": "",
                        "tags": [],
                        "map_objects": [],
                        "sublocations": [],
                    })
                    sub_upsert["id"] = str(sub_loc.id)
                    try:
                        await create_location(
                            data=json.dumps(sub_upsert),
                            icon_file=None,
                            map_file=None,
                            scenario=scenario,
                            current_user=current_user,
                            db=db,
                        )
                    except Exception as e:
                        logger.warning(f"_persist_update_to_db: sub-location create failed: {e}")

            # теперь сохраняем родительскую локацию с полигонами
            from fastapi import HTTPException as FastAPIHTTPException
            try:
                await update_location(
                    location_id=redis_location.id,
                    data=json.dumps(upsert_raw),
                    icon_file=icon_file,
                    map_file=map_file,
                    scenario=scenario,
                    current_user=current_user,
                    db=db,
                )
            except FastAPIHTTPException as http_exc:
                if http_exc.status_code != 404:
                    raise
                await create_location(
                    data=json.dumps(upsert_raw),
                    icon_file=icon_file,
                    map_file=map_file,
                    scenario=scenario,
                    current_user=current_user,
                    db=db,
                )

    # ── toggle hidden ─────────────────────────────────────────────────────────

    async def toggle_location_hidden(
        self,
        current_user: models.User,
        location_id: UUID,
        hidden: bool,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()

        new_locations = []
        updated = False
        for loc in (inner.locations or []):
            if loc.id == location_id:
                tags = list(loc.tags or [])
                if hidden and "hidden" not in tags:
                    tags.append("hidden")
                elif not hidden and "hidden" in tags:
                    tags.remove("hidden")
                new_locations.append(loc.model_copy(update={"tags": tags}))
                updated = True
            else:
                new_locations.append(loc)

        if not updated:
            return False, []

        inner.locations = new_locations
        await self.set_field(
            "locations",
            [loc.model_dump(mode="json") for loc in inner.locations],
        )
        return True, ["locations"]

    # ── add_location_todo ─────────────────────────────────────────────────────

    async def add_location_todo(
        self,
        current_user: models.User,
        location: scheme.LocationOut,
        created: bool,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        act = "создана" if created else "изменена"
        text = (
            f"Локация '{location.name}' {act} при ведении игры '{inner.name}' "
            f"мастером '{inner.master.full_name}' в {inner.created_at}"
        )
        return await self.add_todo(
            user=current_user,
            text=text,
            note=None,
            priority="medium",
            element_type=models.TodoElementType.location,
            element_id=location.id,
            element_name=location.name,
        )

    async def _emit_sublocation_todos(
        self,
        current_user: models.User,
        parent: scheme.LocationOut,
        created: list[scheme.SubLocationRef],
        detached: list[scheme.LocationOut],
    ) -> None:
        inner = await self.get_inner()
        game_label = f"игры '{inner.name}' мастером '{inner.master.full_name}'"

        for sub in created:
            await self.add_todo(
                user=current_user,
                text=f"Подлокация '{sub.name}' создана в локации '{parent.name}' при ведении {game_label}",
                note=None,
                priority="low",
                element_type=models.TodoElementType.location,
                element_id=sub.id,
                element_name=sub.name,
            )

        for loc in detached:
            await self.add_todo(
                user=current_user,
                text=f"Подлокация '{loc.name}' отвязана от '{parent.name}' при ведении {game_label}",
                note=None,
                priority="low",
                element_type=models.TodoElementType.location,
                element_id=loc.id,
                element_name=loc.name,
            )