# session/player_manager.py
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID
from typing import Any, Tuple

from app import models, scheme
from app.infrastructure.database import AsyncSessionLocal

from .character_manager import SessionCharacterManager


class SessionPlayerManager(SessionCharacterManager):
    def _assigned_character_ids(self, inner: scheme.GameSessionInner, *, exclude_player_id: UUID | None = None) -> set[str]:
        out: set[str] = set()
        for p in inner.players or []:
            if exclude_player_id and str(p.id) == str(exclude_player_id):
                continue
            if p.character_id:
                out.add(str(p.character_id))
        return out

    async def _runtime_player_by_id(self, inner: scheme.GameSessionInner, player_id: UUID):
        return next((p for p in (inner.players or []) if str(p.id) == str(player_id)), None)

    async def _persist_players(self, players: list) -> None:
        await self.set_field("players", players)

    async def master_set_player_color(self, user: models.User, player_id: UUID, color: str) -> Tuple[bool, list[str]]:
        if not await self.is_master(user):
            return False, []

        inner = await self.get_inner()
        player = await self._runtime_player_by_id(inner, player_id)
        if player is None:
            return False, []

        players_out: list[dict[str, Any]] = []
        for p in inner.players or []:
            d = p.model_dump(mode="json")
            if str(p.id) == str(player_id):
                d["color"] = color
            players_out.append(d)

        async with AsyncSessionLocal() as db:
            db_player = await db.get(models.Player, player_id)
            if db_player is None:
                return False, []
            db_player.color = color
            await db.commit()

        await self._persist_players(players_out)
        return True, ["players", "self_player"]

    async def master_kick_player(self, user: models.User, player_id: UUID) -> Tuple[bool, list[str]]:
        if not await self.is_master(user):
            return False, []

        inner = await self.get_inner()
        before = len(inner.players or [])
        players_out = [
            p.model_dump(mode="json")
            for p in (inner.players or [])
            if str(p.id) != str(player_id)
        ]
        if len(players_out) == before:
            return False, []

        async with AsyncSessionLocal() as db:
            db_player = await db.get(models.Player, player_id)
            if db_player is not None:
                await db.delete(db_player)
                await db.commit()

        await self._persist_players(players_out)
        return True, ["players"]

    async def master_deselect_character(self, user: models.User, player_id: UUID) -> Tuple[bool, list[str]]:
        if not await self.is_master(user):
            return False, []

        inner = await self.get_inner()
        player = await self._runtime_player_by_id(inner, player_id)
        if player is None:
            return False, []

        old_character_id = player.character_id
        if not old_character_id:
            return True, []

        inner = await self._remove_character_from_scenes(inner, old_character_id)

        players_out: list[dict[str, Any]] = []
        for p in inner.players or []:
            d = p.model_dump(mode="json")
            if str(p.id) == str(player_id):
                d["character_id"] = None
                d["character"] = None
                d["character_snapshot"] = None
                d.pop("character_source_type", None)
            players_out.append(d)

        async with AsyncSessionLocal() as db:
            db_player = await db.get(models.Player, player_id)
            if db_player is not None:
                db_player.character_id = None
                db_player.character_snapshot = None
                db_player.character_source_type = None
                await db.commit()

        await self._persist_players(players_out)
        return True, ["players", "scenes", "self_player"]

    async def master_assign_character(
        self,
        user: models.User,
        player_id: UUID,
        character_id: UUID,
    ) -> Tuple[bool, list[str]]:
        if not await self.is_master(user):
            return False, []

        inner = await self.get_inner()
        player = await self._runtime_player_by_id(inner, player_id)
        if player is None:
            return False, []

        assigned = self._assigned_character_ids(inner, exclude_player_id=player_id)
        if str(character_id) in assigned:
            return False, []

        new_inner_ch = next((c for c in (inner.characters or []) if str(c.id) == str(character_id)), None)
        if new_inner_ch is None:
            return False, []

        new_snapshot = self._character_dict_from_inner(new_inner_ch)
        new_snapshot["captured_at"] = datetime.now(timezone.utc).isoformat()

        old_character_id = player.character_id
        if old_character_id and str(old_character_id) != str(character_id):
            inner = await self._remove_character_from_scenes(inner, old_character_id)

        players_out: list[dict[str, Any]] = []
        for p in inner.players or []:
            d = p.model_dump(mode="json")
            if str(p.id) == str(player_id):
                d["character_id"] = character_id
                d["character"] = new_snapshot
                d["character_snapshot"] = new_snapshot
                d["character_source_type"] = "scenario"
            players_out.append(d)

        async with AsyncSessionLocal() as db:
            db_player = await db.get(models.Player, player_id)
            if db_player is not None:
                db_player.character_id = character_id
                db_player.character_source_type = "scenario"
                db_player.character_snapshot = new_snapshot
                await db.commit()

        await self._persist_players(players_out)
        return True, ["players", "characters", "scenes", "self_player"]
