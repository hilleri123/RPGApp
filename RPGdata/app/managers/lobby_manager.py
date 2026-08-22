from __future__ import annotations

import uuid
from redis.commands.json.path import Path
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.infrastructure.redis_service import redis_client
from app import models, scheme
from app.logger import logger
from app.infrastructure.database import get_async_session as get_db
from .session_manager import session_manager


LOBBY_KEY_PREFIX = "lobby"

class CurrentLobbyManager:

    def __init__(self, lobby_id: str):
        self.lobby_id = lobby_id
    
    def _lobby_key(self) -> str:
        return f"{LOBBY_KEY_PREFIX}:{self.lobby_id}"

    def _m_path(self, field_name: str) -> Path:
        assert field_name in scheme.Lobby.__fields__, f"Поле {field_name} отсутствует в модели"
        return Path(f'.{field_name}')
    
    
    async def delete_lobby(self):
        """Полностью удаляет лобби"""
        await redis_client.json().delete(self._lobby_key())
    
    async def add_to_lobby(self, user: models.User):
        await redis_client.json().arrappend(
            self._lobby_key(),
            self._m_path('users'),
            scheme.User.model_validate(user).model_dump(mode="json")
        )
    
    async def remove_from_lobby(self, user: models.User):
        if not await self.lobby_exists():
            return

        users = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('users')
        ) or []

        new_users = [u for u in users if str(u.get("id")) != str(user.id)]
        if len(new_users) == len(users):
            return

        await redis_client.json().set(
            self._lobby_key(),
            self._m_path('users'),
            new_users,
        )
    
    async def lobby_exists(self) -> bool:
        return await redis_client.exists(self._lobby_key()) == 1
    
    async def select_lobby_scenario(self, scenario_id: int) -> bool:
        async for db in get_db():
            stmt = select(models.Scenario).options(
                selectinload(models.Scenario.user),
                selectinload(models.Scenario.characters)
                .selectinload(models.PlayerCharacter.owned_item_links)
                .selectinload(models.ItemOwnership.item)
            ).where(models.Scenario.id == scenario_id)
            result = await db.execute(stmt)
            scenario: models.Scenario = result.scalars().first()
            characters = [scheme.PlayerCharacterOut.model_validate(c).model_dump(mode="json") for c in scenario.characters]
        await redis_client.json().set(
                self._lobby_key(),
                self._m_path('scenario'),
                scheme.Scenario.model_validate(scenario).model_dump(mode="json")
            )
        await redis_client.json().set(
                self._lobby_key(),
                self._m_path('characters'),
                characters
            )
        await redis_client.json().set(
                self._lobby_key(),
                self._m_path('campaign_id'),
                None,
            )
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players')
        )
        players_to_set = []
        for player_data in players:
            player = scheme.Player(**player_data)
            player.character_id = None
            players_to_set.append(player.model_dump(mode='json'))
        await redis_client.json().set(
                self._lobby_key(),
                self._m_path('players'),
                players_to_set
            )
        
        return True

    async def _bindings_for_launched_scenario(
        self,
        db,
        launched_scenario_id: uuid.UUID,
    ) -> dict[str, dict]:
        """user_id_str -> {character_id, application_id?, character_dict?} for lobby prefill."""
        bindings: dict[str, dict] = {}

        char_stmt = select(models.PlayerCharacter).where(
            models.PlayerCharacter.scenario_id == launched_scenario_id,
            models.PlayerCharacter.bound_user_id.is_not(None),
        )
        for ch in (await db.execute(char_stmt)).scalars().all():
            bindings[str(ch.bound_user_id)] = {
                "character_id": ch.id,
                "application_id": None,
            }

        # Fallback: last approach session player assignments (covers detached app chars).
        last_gs_id = (
            await db.execute(
                select(models.GameSession.id)
                .where(models.GameSession.launched_scenario_id == launched_scenario_id)
                .order_by(models.GameSession.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if last_gs_id:
            players = (
                await db.execute(
                    select(models.Player).where(
                        models.Player.game_session_id == last_gs_id,
                        models.Player.character_id.is_not(None),
                    )
                )
            ).scalars().all()
            char_ids = [p.character_id for p in players if p.character_id]
            apps_by_pc: dict[uuid.UUID, models.CharacterApplication] = {}
            if char_ids:
                from app.services.application_entity_service import (
                    character_dict_from_application,
                    sync_application_character_from_application,
                )

                app_rows = (
                    await db.execute(
                        select(models.CharacterApplication)
                        .where(models.CharacterApplication.player_character_id.in_(char_ids))
                        .options(
                            selectinload(models.CharacterApplication.player_character)
                            .selectinload(models.PlayerCharacter.owned_item_links)
                            .selectinload(models.ItemOwnership.item),
                        )
                    )
                ).scalars().all()
                for app in app_rows:
                    if app.player_character_id:
                        await sync_application_character_from_application(db, app)
                        apps_by_pc[app.player_character_id] = app

            for p in players:
                uid = str(p.user_id)
                if uid in bindings:
                    continue
                cid = p.character_id
                if not cid:
                    continue
                app = apps_by_pc.get(cid)
                entry: dict = {"character_id": cid, "application_id": None}
                if app is not None:
                    entry["application_id"] = app.id
                    entry["character_dict"] = character_dict_from_application(app)
                bindings[uid] = entry

        # Enrich scenario-bound chars that are also application pool rows.
        bound_cids = [b["character_id"] for b in bindings.values() if b.get("character_id")]
        if bound_cids:
            from app.services.application_entity_service import character_dict_from_application

            app_rows = (
                await db.execute(
                    select(models.CharacterApplication)
                    .where(models.CharacterApplication.player_character_id.in_(bound_cids))
                    .options(
                        selectinload(models.CharacterApplication.player_character)
                        .selectinload(models.PlayerCharacter.owned_item_links)
                        .selectinload(models.ItemOwnership.item),
                    )
                )
            ).scalars().all()
            apps_by_pc = {a.player_character_id: a for a in app_rows if a.player_character_id}
            for entry in bindings.values():
                cid = entry.get("character_id")
                app = apps_by_pc.get(cid) if cid else None
                if app is not None:
                    entry["application_id"] = app.id
                    entry["character_dict"] = character_dict_from_application(app)

        return bindings

    async def _apply_bindings_to_lobby_players(
        self,
        bindings: dict[str, dict],
    ) -> None:
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path("players"),
        ) or []
        if not players:
            return

        imported = await redis_client.json().get(
            self._lobby_key(), Path(".imported_characters")
        ) or []
        imported_ids = {str(c.get("id")) for c in imported}

        players_to_set = []
        for player_data in players:
            player = scheme.Player(**player_data)
            uid = str(player.user.id) if player.user else None
            binding = bindings.get(uid) if uid else None
            if binding and binding.get("character_id"):
                player.character_id = binding["character_id"]
                player.application_id = binding.get("application_id")
                char_dict = binding.get("character_dict")
                if char_dict and str(char_dict.get("id")) not in imported_ids:
                    imported.append(char_dict)
                    imported_ids.add(str(char_dict.get("id")))
            else:
                player.character_id = None
                player.application_id = None
            players_to_set.append(player.model_dump(mode="json"))

        await redis_client.json().set(
            self._lobby_key(),
            self._m_path("players"),
            players_to_set,
        )
        await redis_client.json().set(
            self._lobby_key(),
            Path(".imported_characters"),
            imported,
        )

    async def select_lobby_launched_scenario(self, launched_scenario_id: uuid.UUID) -> bool:
        scenario_payload: dict | None = None
        characters: list[dict] = []
        bindings: dict[str, dict] = {}

        async for db in get_db():
            stmt = (
                select(models.Scenario)
                .where(models.Scenario.id == launched_scenario_id)
                .options(selectinload(models.Scenario.user))
            )
            scenario = (await db.execute(stmt)).scalars().first()
            if not scenario or not scenario.is_session_snapshot:
                return False
            if scenario.lifecycle_status == "closed":
                return False

            char_stmt = (
                select(models.PlayerCharacter)
                .where(models.PlayerCharacter.scenario_id == launched_scenario_id)
                .options(
                    selectinload(models.PlayerCharacter.owned_item_links).selectinload(
                        models.ItemOwnership.item
                    )
                )
            )
            chars = (await db.execute(char_stmt)).scalars().all()
            characters = [
                scheme.PlayerCharacterOut.model_validate(c).model_dump(mode="json") for c in chars
            ]
            scenario_payload = scheme.Scenario.model_validate(scenario).model_dump(mode="json")
            bindings = await self._bindings_for_launched_scenario(db, launched_scenario_id)
            await db.commit()

        if scenario_payload is None:
            return False

        await redis_client.json().set(
            self._lobby_key(),
            self._m_path("scenario"),
            scenario_payload,
        )
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path("characters"),
            characters,
        )
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path("launched_scenario_id"),
            str(launched_scenario_id),
        )
        await redis_client.json().set(self._lobby_key(), self._m_path("campaign_id"), None)
        await redis_client.json().set(self._lobby_key(), self._m_path("party_id"), None)

        await self._apply_bindings_to_lobby_players(bindings)
        return True

    async def select_lobby_party(self, party_id: uuid.UUID) -> bool:
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path("party_id"),
            str(party_id),
        )
        return True

    async def _apply_carryover_to_lobby_players(self, campaign: models.Campaign) -> None:
        carryover = campaign.carryover_state
        if not carryover or campaign.current_step_index <= 0:
            return
        chars_by_user = carryover.get("characters_by_user") or {}
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path("players"),
        )
        if not players:
            return
        changed = False
        for player in players:
            uid = str(player.get("user", {}).get("id", ""))
            ch = chars_by_user.get(uid)
            if ch and ch.get("id"):
                player["character_id"] = str(ch["id"])
                player["is_ready"] = True
                changed = True
        if changed:
            await redis_client.json().set(
                self._lobby_key(),
                self._m_path("players"),
                players,
            )

    async def select_lobby_campaign(self, campaign_id: uuid.UUID) -> bool:
        from app.services.campaign_service import _load_campaign

        launched_id: uuid.UUID | None = None
        async for db in get_db():
            campaign = await _load_campaign(db, campaign_id)
            if not campaign:
                return False
            links = sorted(campaign.scenario_links or [], key=lambda x: x.order_num)
            if not links:
                return False
            launched_id = campaign.launched_scenario_id
            if launched_id is None:
                step = min(campaign.current_step_index, len(links) - 1)
                scenario_id = links[step].scenario_id
                ok = await self.select_lobby_scenario(scenario_id)
            else:
                ok = await self.select_lobby_launched_scenario(launched_id)
            if not ok:
                return False
            await redis_client.json().set(
                self._lobby_key(),
                self._m_path("campaign_id"),
                str(campaign_id),
            )
            await self._apply_carryover_to_lobby_players(campaign)
            return True
        return False
    
    async def _clear_player_character(self, *, player_id: uuid.UUID | None = None, user_id: uuid.UUID | None = None) -> bool:
        if player_id is None and user_id is None:
            return False
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players'),
        )
        if not players:
            return False
        for player_ind, player in enumerate(players):
            if player_id is not None and str(player.get("id")) == str(player_id):
                break
            if user_id is not None and str((player.get("user") or {}).get("id")) == str(user_id):
                break
        else:
            return False
        players[player_ind].pop("character_id", None)
        players[player_ind].pop("application_id", None)
        players[player_ind].pop("character", None)
        players[player_ind]["is_ready"] = False
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path('players'),
            players,
        )
        return True

    async def _assign_player_character(
        self,
        user: models.User,
        *,
        character_id: uuid.UUID,
        application_id: uuid.UUID | None = None,
    ) -> bool:
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players'),
        )
        if not players:
            return False
        for player_ind, player in enumerate(players):
            if str((player.get("user") or {}).get("id")) != str(user.id):
                continue
            players[player_ind]["character_id"] = str(character_id)
            if application_id is not None:
                players[player_ind]["application_id"] = str(application_id)
            else:
                players[player_ind].pop("application_id", None)
            players[player_ind].pop("character", None)
            await redis_client.json().set(
                self._lobby_key(),
                self._m_path('players'),
                players,
            )
            return True
        return False

    async def force_player_deselect_character(
        self,
        player_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
    ) -> bool:
        if await self._clear_player_character(player_id=player_id):
            return True
        if user_id is not None:
            return await self._clear_player_character(user_id=user_id)
        return False

    async def became_player(self, db_user: models.User, player_create: scheme.PlayerCreate) -> bool:
        ok = await self.remove_user(db_user)
        if not ok:
            return ok
        user = scheme.User.model_validate(db_user)
        
        db_player = models.Player(
            **player_create.model_dump(exclude={"application_id"}, exclude_none=True),
            user_id=user.id,
        )
        async for db in get_db():
            db.add(db_player)
            await db.commit()
            await db.refresh(db_player)
            result = await db.execute(select(models.Player).where(
                models.Player.id == db_player.id).options(
                selectinload(models.Player.user)))
            db_player = result.scalars().first()

        player = scheme.Player.model_validate(db_player)

        # Prefill character if this launched scenario was played before by this user.
        launched_raw = await redis_client.json().get(
            self._lobby_key(),
            self._m_path("launched_scenario_id"),
        )
        if launched_raw:
            try:
                launched_id = uuid.UUID(str(launched_raw))
            except (TypeError, ValueError):
                launched_id = None
            if launched_id:
                async for db in get_db():
                    bindings = await self._bindings_for_launched_scenario(db, launched_id)
                    await db.commit()
                binding = bindings.get(str(user.id))
                if binding and binding.get("character_id"):
                    player.character_id = binding["character_id"]
                    player.application_id = binding.get("application_id")
                    char_dict = binding.get("character_dict")
                    if char_dict:
                        imported = await redis_client.json().get(
                            self._lobby_key(), Path(".imported_characters")
                        ) or []
                        if not any(str(c.get("id")) == str(char_dict.get("id")) for c in imported):
                            imported.append(char_dict)
                            await redis_client.json().set(
                                self._lobby_key(),
                                Path(".imported_characters"),
                                imported,
                            )

        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players')
        )
        players.append(player.model_dump(mode='json'))
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path('players'),
            players
        )
        return True
    
    async def player_select_character(self, user: models.User, character_id: uuid.UUID) -> bool:
        cid = character_id if isinstance(character_id, uuid.UUID) else uuid.UUID(str(character_id))
        return await self._assign_player_character(user, character_id=cid, application_id=None)
    
    async def player_deselect_character(self, user: models.User) -> bool:
        return await self._clear_player_character(user_id=user.id)

    async def player_ready(self, user: models.User, is_ready: bool) -> bool:
        return await self._player_set(
            lambda p: p["user"]["id"] == str(user.id), 
            "is_ready", is_ready)
    
    async def player_select_color(self, user: models.User, color: str) -> bool:
        return await self._player_set(
            lambda p: p["user"]["id"] == str(user.id), 
            "color", color)

    async def _player_set(self, check, key: str, value) -> bool:
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players')
        )
        logger.debug(f"{players=} {key=} {value=}")
        for player_ind, player in enumerate(players):
            if check(player):
                break
        else:
            return False
        logger.debug(f"{player=} {player_ind=} {key=} {value=}")
        players[player_ind][key] = value if not isinstance(value, uuid.UUID) else str(value)
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path('players'),
            players
        )
        return True

    async def remove_user(self, user: models.User):
        users = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('users')
        )
        before_len = len(users)
        users = [u for u in users if u["id"] != str(user.id)]
        if before_len == len(users):
            return False
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path('users'),
            users
        )
        return True
    
    async def is_banned(self, user: models.User) -> bool:
        try:
            banned = await redis_client.json().get(
                self._lobby_key(),
                self._m_path('banned_user_ids'),
            )
        except Exception:
            # Лобби, созданные до появления поля, путь не содержат.
            return False
        return str(user.id) in {str(b) for b in (banned or [])}

    async def _ban_user_id(self, user_id: uuid.UUID) -> None:
        try:
            banned = await redis_client.json().get(
                self._lobby_key(),
                self._m_path('banned_user_ids'),
            ) or []
        except Exception:
            banned = []
        if str(user_id) in {str(b) for b in banned}:
            return
        banned.append(str(user_id))
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path('banned_user_ids'),
            banned,
        )

    async def kick_player(self, player_id: uuid.UUID):
        """Кик мастера должен держаться: выгнанный не возвращается реконнектом."""
        user_id = await self._user_id_of_player(player_id)
        removed = await self.remove_player(player_id)
        if removed and user_id:
            await self._ban_user_id(user_id)
        return removed

    async def _user_id_of_player(self, player_id: uuid.UUID) -> Optional[uuid.UUID]:
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players')
        ) or []
        for p in players:
            if str(p.get("id")) == str(player_id):
                user = p.get("user") or {}
                return user.get("id")
        return None

    async def remove_player(self, player_id: uuid.UUID):
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players')
        )
        before_len = len(players)
        players = [p for p in players if p["id"] != str(player_id)]
        if before_len == len(players):
            return False
        await redis_client.json().set(
            self._lobby_key(),
            self._m_path('players'),
            players
        )
        return True

    async def get_recipients(self) -> List[scheme.User]:
        res = []
        data = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('master')
        )
        master = scheme.User(**data)
        res.append(master)
        users = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('users')
        )
        res += [scheme.User(**data) for data in users]
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players')
        )
        res += [scheme.Player(**data).user for data in players]
        return res
    
    async def is_master(self, user: models.User) -> bool:
        data = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('master')
        )
        master = scheme.User(**data)
        return master.id == user.id

    async def is_user(self, user: models.User) -> bool:
        users = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('users')
        )
        for data in users:
            u = scheme.User(**data)
            if u.id == user.id:
                return True
        return False

    async def is_player(self, user: models.User) -> bool:
        players = await redis_client.json().get(
            self._lobby_key(),
            self._m_path('players')
        )
        for data in players:
            p = scheme.Player(**data)
            if p.user.id == user.id:
                return True
        return False

    async def get_lobby(self) -> scheme.Lobby:
        data = await redis_client.json().get(self._lobby_key())
        return scheme.Lobby(**data)

    async def start_session(self) -> Optional[scheme.SessionRedirect]:
        lobby = await self.get_lobby()
        if len(lobby.players) == 0:
            return None

        if getattr(lobby, "campaign_id", None):
            from app.services.campaign_service import _load_campaign, create_campaign_session

            async for db in get_db():
                campaign = await _load_campaign(db, lobby.campaign_id)
                if not campaign:
                    return None
                has_carryover = bool(campaign.carryover_state) and campaign.current_step_index > 0
                if not has_carryover:
                    for player in lobby.players:
                        if not player.character_id or not player.is_ready:
                            return None
                else:
                    for player in lobby.players:
                        if not player.is_ready:
                            return None
                return await create_campaign_session(
                    db,
                    campaign=campaign,
                    lobby=lobby,
                    step_index=campaign.current_step_index,
                )

        for player in lobby.players:
            if not player.character_id or not player.is_ready:
                return None

        return await session_manager.create_session(lobby)

    async def close_lobby(self, user: models.User) -> bool:
        if not await self.is_master(user):
            return False
        await self.delete_lobby()
        return True
        

    async def player_select_application_character(
        self,
        user: models.User,
        application_id: uuid.UUID,
    ) -> bool:
        app: models.CharacterApplication | None = None

        async for db in get_db():
            result = await db.execute(
                select(models.CharacterApplication)
                .where(
                    models.CharacterApplication.id == application_id,
                    models.CharacterApplication.user_id == user.id,
                    models.CharacterApplication.status == models.ApplicationStatus.approved,
                )
                .options(
                    selectinload(models.CharacterApplication.player_character)
                    .selectinload(models.PlayerCharacter.owned_item_links)
                    .selectinload(models.ItemOwnership.item),
                )
            )
            app = result.scalars().first()
            if not app:
                return False
            from app.services.application_entity_service import (
                character_dict_from_application,
                sync_application_character_from_application,
            )

            await sync_application_character_from_application(db, app)
            await db.commit()

        if not app or not app.player_character_id:
            return False

        # Проверяем совпадение системы
        scenario_data = await redis_client.json().get(
            self._lobby_key(), self._m_path('scenario')
        )
        if scenario_data:
            lobby_rule = scenario_data.get('rule_id_str')
            if lobby_rule and lobby_rule != app.rule_id_str:
                return False

        # Добавляем в imported_characters если ещё нет
        imported = await redis_client.json().get(
            self._lobby_key(), Path('.imported_characters')
        ) or []

        if not any(str(c.get('id')) == str(app.player_character_id) for c in imported):
            imported.append(character_dict_from_application(app))
            await redis_client.json().set(
                self._lobby_key(), Path('.imported_characters'), imported
            )

        # Пишем character_id игрока (player_character из заявки)
        return await self._assign_player_character(
            user,
            character_id=app.player_character_id,
            application_id=app.id,
        )

            
class LobbyManager:

    def __init__(self):
        self.managers = {}

    def __getitem__(self, lobby_id: str) -> CurrentLobbyManager:
        if not lobby_id in self.managers:
            self.managers[lobby_id] = CurrentLobbyManager(lobby_id)
        return self.managers[lobby_id]
    
    async def list_lobbies(self) -> List[scheme.LobbyPreview]:
        lobbies = []
        async for key in redis_client.scan_iter(f'{LOBBY_KEY_PREFIX}:*'):
            lobby_data = await redis_client.json().get(key)
            if lobby_data:
                lobbies.append(
                    scheme.LobbyPreview.from_lobby(scheme.Lobby(**lobby_data))
                )
        return lobbies

    async def create_lobby(self, lobby_data: scheme.LobbyCreate, current_user: models.User) -> scheme.Lobby:
        lobby_id = str(uuid.uuid4())
        #TODO lobby_data.master_id

        lobby = scheme.Lobby(
            id=lobby_id,
            master=scheme.User.model_validate(current_user),
            **lobby_data.model_dump(mode="json")
        )
        await redis_client.json().set(
            f'{LOBBY_KEY_PREFIX}:{lobby_id}',
            Path.root_path(),
            lobby.model_dump(mode='json')
        )
        return lobby



manager = LobbyManager()
