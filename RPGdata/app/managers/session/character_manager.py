# session/character_manager.py
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID
from typing import Any, Tuple

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.infrastructure.database import AsyncSessionLocal
from app.logger import logger
from app.models.character_application.character import ApplicationStatus

from app.services.scenario_entities.common import with_db
from app.services.scenario_entities import characters as character_service
from app.services.application_entity_service import (
    attach_application_characters_to_scenario,
    character_dict_from_application,
)

from .user_manager import SessionUserManager


class SessionCharacterManager(SessionUserManager):
    def __init__(self, session_id: UUID | str):
        super().__init__(str(session_id))

    async def own(self, user: models.User, character_id: UUID) -> bool:
        inner = await self.get_inner()

        if inner.master and str(inner.master.id) == str(user.id):
            return True

        for p in inner.players or []:
            if str(p.user.id) == str(user.id):
                return str(p.character_id) == str(character_id)

        return False

    def _assigned_character_ids(self, inner: scheme.GameSessionInner) -> set[str]:
        out: set[str] = set()
        for p in inner.players or []:
            if p.character_id:
                out.add(str(p.character_id))
        return out

    def _character_dict_from_inner(self, ch: Any) -> dict[str, Any]:
        return ch.model_dump(mode="json") if hasattr(ch, "model_dump") else dict(ch)

    async def list_replace_character_options(self, user: models.User) -> list[dict[str, Any]]:
        inner = await self.get_inner()
        assigned = self._assigned_character_ids(inner)
        current_player = next((p for p in (inner.players or []) if str(p.user.id) == str(user.id)), None)
        current_id = str(current_player.character_id) if current_player and current_player.character_id else None

        options: list[dict[str, Any]] = []
        for ch in inner.characters or []:
            cid = str(ch.id)
            if cid in assigned and cid != current_id:
                continue
            options.append({
                "id": cid,
                "name": ch.name,
                "short_desc": getattr(ch, "short_desc", None),
                "source": "scenario",
                "application_id": None,
            })

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(models.CharacterApplication)
                .where(
                    models.CharacterApplication.user_id == user.id,
                    models.CharacterApplication.status == ApplicationStatus.approved,
                    models.CharacterApplication.rule_id_str == inner.rule_id_str,
                )
                .options(
                    selectinload(models.CharacterApplication.player_character)
                    .selectinload(models.PlayerCharacter.owned_item_links)
                    .selectinload(models.ItemOwnership.item),
                )
            )
            apps = list(result.scalars().all())

        for app in apps:
            if not app.player_character_id:
                continue
            pc_id = str(app.player_character_id)
            if pc_id in assigned and pc_id != current_id:
                continue
            row = character_dict_from_application(app)
            options.append({
                "id": pc_id,
                "name": row.get("name") or app.name,
                "short_desc": row.get("short_desc"),
                "source": "application",
                "application_id": str(app.id),
            })

        return options

    async def _return_character_to_application_pool(
        self,
        db,
        *,
        user: models.User,
        old_ch: models.PlayerCharacter,
        session_id: UUID,
        rule_id_str: str,
    ) -> None:
        existing = await db.execute(
            select(models.CharacterApplication).where(
                models.CharacterApplication.player_character_id == old_ch.id,
                models.CharacterApplication.user_id == user.id,
            )
        )
        if existing.scalars().first():
            return

        app = models.CharacterApplication(
            user_id=user.id,
            rule_id_str=rule_id_str,
            name=old_ch.name,
            short_desc=old_ch.short_desc,
            story=old_ch.story,
            tags=old_ch.tags or [],
            data=old_ch.data or {},
            icon_url=old_ch.icon_url,
            img_url=old_ch.img_url,
            status=ApplicationStatus.approved,
            submitted_at=datetime.now(timezone.utc),
            source_kind="session_swap",
            source_session_id=session_id,
            player_character_id=old_ch.id,
        )
        db.add(app)
        await db.flush()

    async def _remove_character_from_scenes(self, inner: scheme.GameSessionInner, character_id: UUID) -> scheme.GameSessionInner:
        scenes = list(inner.scenes or [])
        changed = False
        cid = str(character_id)
        for scene in scenes:
            ids = [str(x) for x in (scene.character_ids or [])]
            if cid in ids:
                scene.character_ids = [x for x in scene.character_ids if str(x) != cid]
                changed = True
        if changed:
            await self.set_scenes(scenes)
        return await self.get_inner()

    async def _update_runtime_player(
        self,
        user_id: UUID,
        *,
        character_id: UUID,
        character_snapshot: dict[str, Any],
        character_source_type: str | None,
    ) -> None:
        inner = await self.get_inner()
        players = list(inner.players or [])
        updated_players = []
        for p in players:
            if str(p.user.id) != str(user_id):
                updated_players.append(p)
                continue
            d = p.model_dump(mode="json")
            d["character_id"] = character_id
            d["character"] = character_snapshot
            d["character_snapshot"] = character_snapshot
            if character_source_type:
                d["character_source_type"] = character_source_type
            updated_players.append(scheme.PlayerWithCharacter.model_validate(d))
        await self.set_field("players", [p.model_dump(mode="json") for p in updated_players])

    async def replace_character(
        self,
        user: models.User,
        *,
        new_character_id: UUID,
        application_id: UUID | None = None,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        player = next((p for p in (inner.players or []) if str(p.user.id) == str(user.id)), None)
        if player is None:
            return False, []

        old_character_id = player.character_id
        if old_character_id and str(old_character_id) == str(new_character_id):
            return True, []

        assigned = self._assigned_character_ids(inner)
        if str(new_character_id) in assigned and str(new_character_id) != str(old_character_id or ""):
            return False, []

        new_inner_ch = next((c for c in (inner.characters or []) if str(c.id) == str(new_character_id)), None)
        scenario_id = await self.get_scenario_id()
        allow_swap = bool(getattr(inner.settings, "allow_character_swap", False))

        async with AsyncSessionLocal() as db:
            new_db_ch = await db.get(
                models.PlayerCharacter,
                new_character_id,
                options=[
                    selectinload(models.PlayerCharacter.owned_item_links).selectinload(models.ItemOwnership.item),
                ],
            )
            if new_db_ch is None or new_db_ch.scenario_id not in (None, scenario_id):
                if application_id:
                    app = await db.get(
                        models.CharacterApplication,
                        application_id,
                        options=[
                            selectinload(models.CharacterApplication.player_character)
                            .selectinload(models.PlayerCharacter.owned_item_links)
                            .selectinload(models.ItemOwnership.item),
                        ],
                    )
                    if (
                        app is None
                        or str(app.user_id) != str(user.id)
                        or app.status != ApplicationStatus.approved
                        or str(app.player_character_id) != str(new_character_id)
                    ):
                        return False, []
                    await attach_application_characters_to_scenario(
                        db,
                        scenario_id=scenario_id,
                        applications=[app],
                    )
                    new_db_ch = app.player_character
                    await db.commit()
                    await self.invalidate_entity_cache()
                    inner = await self.get_inner()
                    new_inner_ch = next((c for c in (inner.characters or []) if str(c.id) == str(new_character_id)), None)
                else:
                    return False, []

            if new_inner_ch is None and new_db_ch is not None:
                if new_db_ch.scenario_id is None:
                    new_db_ch.scenario_id = scenario_id
                await db.commit()
                await self.invalidate_entity_cache()
                inner = await self.get_inner()
                new_inner_ch = next((c for c in (inner.characters or []) if str(c.id) == str(new_character_id)), None)

            if new_inner_ch is None:
                return False, []

            source_type = "application" if application_id else "scenario"
            new_snapshot = self._character_dict_from_inner(new_inner_ch)
            new_snapshot["captured_at"] = datetime.now(timezone.utc).isoformat()

            if old_character_id:
                inner = await self._remove_character_from_scenes(inner, old_character_id)
                old_db_ch = await db.get(
                    models.PlayerCharacter,
                    old_character_id,
                    options=[
                        selectinload(models.PlayerCharacter.owned_item_links).selectinload(models.ItemOwnership.item),
                    ],
                )
                if old_db_ch is not None:
                    await self._return_character_to_application_pool(
                        db,
                        user=user,
                        old_ch=old_db_ch,
                        session_id=UUID(str(inner.id)),
                        rule_id_str=inner.rule_id_str,
                    )
                    if not allow_swap:
                        old_db_ch.scenario_id = None
                        old_db_ch.location_id = None

            approach_id = UUID(str(inner.id))
            db_player = (
                await db.execute(
                    select(models.Player).where(
                        models.Player.game_session_id == approach_id,
                        models.Player.user_id == user.id,
                    )
                )
            ).scalars().first()
            if db_player is not None:
                db_player.character_id = new_character_id
                db_player.character_source_type = source_type
                db_player.character_snapshot = new_snapshot

            await db.commit()

        await self._update_runtime_player(
            user.id,
            character_id=new_character_id,
            character_snapshot=new_snapshot,
            character_source_type=source_type,
        )

        return True, ["characters", "scenes", "players", "self_player"]

    async def update_character(
        self,
        user: models.User,
        character: Any,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()

        if hasattr(character, "model_dump"):
            ch_data = character.model_dump(mode="json")
        else:
            ch_data = dict(character or {})

        character_id = ch_data.get("id")
        if not character_id:
            logger.warning("update_character: missing character.id")
            return False, []

        try:
            ch_uuid = character_id if isinstance(character_id, UUID) else UUID(str(character_id))
        except Exception:
            logger.warning(f"update_character: invalid character.id={character_id!r}")
            return False, []

        if not await self.own(user, character_id=ch_uuid):
            return False, []

        ok, issues, enriched, new_tags = await self.validate_data(
            entity="character",
            data=ch_data.get("data") or {},
            tags=ch_data.get("tags") or [],
            context={},
        )
        force = bool(ch_data.get("force", False))
        if (not ok) and (not force):
            return False, []

        scenario_id = await self.get_scenario_id()
        await with_db(
            lambda db: character_service.update_character_from_ws_dict(
                db,
                scenario_id=scenario_id,
                ch_dict=ch_data,
                enriched_data=enriched,
                tags=new_tags,
            )
        )
        await self.invalidate_entity_cache()

        return True, ["characters", "self_player"]
