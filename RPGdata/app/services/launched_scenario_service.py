"""Launch scenario once, start approaches, enforce single active approach."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.infrastructure.redis_service import redis_client
from app.logger import logger
from app.managers._helper import _convert_player
from app.managers.session import SESSION_KEY_PREFIX
from app.managers.session.entity_loader import SessionEntityLoader
from app.scheme.session.runtime import SessionRuntimeState
from app.scheme.session.timeline import SessionTimelineInner
from app.services.scenario_cloner import CloneResult, clone_scenario_for_session
from redis.commands.json.path import Path

LAUNCHED_KEY_PREFIX = "launched"


class ConcurrentApproachError(ValueError):
    """Another party is already playing this launched scenario."""


class LaunchedScenarioClosedError(ValueError):
    pass


async def assert_no_active_approach(db: AsyncSession, launched_scenario_id: UUID) -> None:
    active_id = await get_active_approach_session_id(db, launched_scenario_id)
    if active_id:
        raise ConcurrentApproachError(
            f"launched scenario {launched_scenario_id} already has active approach {active_id}"
        )


async def get_active_approach_session_id(
    db: AsyncSession,
    launched_scenario_id: UUID,
) -> UUID | None:
    """Return the live approach id, healing DB rows that Redis no longer binds."""
    key = f"{LAUNCHED_KEY_PREFIX}:{launched_scenario_id}"
    redis_approach_id: UUID | None = None
    data = await redis_client.json().get(key)
    if data:
        try:
            redis_approach_id = SessionRuntimeState.model_validate(data).approach_session_id
        except Exception:
            logger.exception("get_active_approach_session_id: invalid redis payload %s", key)

    stmt = (
        select(models.GameSession)
        .where(
            models.GameSession.launched_scenario_id == launched_scenario_id,
            models.GameSession.is_active == True,
        )
    )
    active_rows = list((await db.execute(stmt)).scalars().all())
    live: UUID | None = None
    healed = False
    for gs in active_rows:
        if redis_approach_id is not None and str(gs.id) == str(redis_approach_id):
            live = gs.id
            continue
        gs.is_active = False
        if gs.status == models.GameSessionStatus.active:
            gs.status = models.GameSessionStatus.finished_forced
        gs.finished_at = gs.finished_at or datetime.now(timezone.utc)
        healed = True
        logger.info(
            "deactivated stale approach %s for launched %s",
            gs.id,
            launched_scenario_id,
        )
    if healed:
        await db.commit()
    return live


async def get_launched_scenario(db: AsyncSession, launched_scenario_id: UUID) -> models.Scenario:
    sc = await db.get(models.Scenario, launched_scenario_id)
    if not sc or not sc.is_session_snapshot:
        raise ValueError(f"launched scenario not found: {launched_scenario_id}")
    if sc.lifecycle_status == "closed":
        raise LaunchedScenarioClosedError(f"launched scenario is closed: {launched_scenario_id}")
    return sc


async def launch_scenario(
    db: AsyncSession,
    *,
    prep_scenario_id: UUID,
    session_name: str,
    launch_mode: str = "multi_party",
    application_characters: list[models.CharacterApplication] | None = None,
) -> CloneResult:
    """First launch: clone prep → running snapshot."""
    clone_result = await clone_scenario_for_session(
        db,
        source_scenario_id=prep_scenario_id,
        session_name=session_name,
        application_characters=application_characters,
    )
    launched = clone_result.scenario
    launched.lifecycle_status = "running"
    launched.launch_mode = launch_mode
    launched.source_scenario_id = prep_scenario_id
    await db.flush()
    return clone_result


async def ensure_default_party(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    name: str = "Партия 1",
    filter_tags: list[str] | None = None,
) -> models.ScenarioParty:
    stmt = (
        select(models.ScenarioParty)
        .where(models.ScenarioParty.launched_scenario_id == launched_scenario_id)
        .order_by(models.ScenarioParty.sort_order)
        .limit(1)
    )
    party = (await db.execute(stmt)).scalars().first()
    if party:
        return party
    party = models.ScenarioParty(
        launched_scenario_id=launched_scenario_id,
        name=name,
        filter_tags=filter_tags or ["party:default"],
        sort_order=0,
    )
    db.add(party)
    await db.flush()
    return party


async def _load_lobby_character_lookups(
    db: AsyncSession,
    lobby: scheme.Lobby,
) -> tuple[dict[UUID, models.CharacterApplication], dict[UUID, models.PlayerCharacter]]:
    from app.services.application_entity_service import index_applications_by_id

    lobby_players = getattr(lobby, "players", None) or []
    all_char_ids = [
        UUID(str(p.character_id)) for p in lobby_players if getattr(p, "character_id", None)
    ]
    apps_by_id: dict[UUID, models.CharacterApplication] = {}
    scenario_chars_by_id: dict[UUID, models.PlayerCharacter] = {}
    if not all_char_ids:
        return apps_by_id, scenario_chars_by_id

    imp_result = await db.execute(
        select(models.CharacterApplication)
        .where(
            or_(
                models.CharacterApplication.id.in_(all_char_ids),
                models.CharacterApplication.player_character_id.in_(all_char_ids),
            )
        )
        .options(
            selectinload(models.CharacterApplication.player_character)
            .selectinload(models.PlayerCharacter.owned_item_links)
            .selectinload(models.ItemOwnership.item),
        )
    )
    apps_by_id = index_applications_by_id(list(imp_result.scalars().all()))
    sc_ids = [cid for cid in all_char_ids if cid not in apps_by_id]
    if sc_ids:
        sc_result = await db.execute(
            select(models.PlayerCharacter).where(models.PlayerCharacter.id.in_(sc_ids))
        )
        for ch in sc_result.scalars().all():
            scenario_chars_by_id[ch.id] = ch
    return apps_by_id, scenario_chars_by_id


async def _build_players_from_lobby(
    db: AsyncSession,
    gs: models.GameSession,
    lobby: scheme.Lobby,
    id_map: dict[UUID, UUID] | None,
    apps_by_id: dict[UUID, models.CharacterApplication],
    scenario_chars_by_id: dict[UUID, models.PlayerCharacter],
) -> list[models.Player]:
    players: list[models.Player] = []
    lobby_players = getattr(lobby, "players", None) or []
    for p in lobby_players:
        raw_cid = getattr(p, "character_id", None)
        char_id_uuid = UUID(str(raw_cid)) if raw_cid else None
        character_source_type: str | None = None
        character_id: UUID | None = None
        character_snapshot: dict | None = None
        user_id = UUID(str(p.user.id))
        bound_pc: models.PlayerCharacter | None = None

        if char_id_uuid is not None:
            app = apps_by_id.get(char_id_uuid)
            scenario_ch = scenario_chars_by_id.get(char_id_uuid)
            new_char_id = id_map.get(char_id_uuid) if id_map else char_id_uuid

            if app is not None and app.player_character_id:
                from app.services.application_entity_service import character_dict_from_application

                character_source_type = "application"
                character_id = app.player_character_id
                snap = character_dict_from_application(app)
                # Pool characters keep their id (identity map); never invent a phantom UUID.
                snap["id"] = str(character_id)
                character_snapshot = {
                    **snap,
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                }
                bound_pc = app.player_character
                if bound_pc is None:
                    bound_pc = await db.get(models.PlayerCharacter, character_id)
            elif scenario_ch is not None and new_char_id:
                character_source_type = "scenario"
                character_id = new_char_id
                character_snapshot = {
                    "id": str(new_char_id),
                    "name": scenario_ch.name,
                    "short_desc": scenario_ch.short_desc,
                    "story": scenario_ch.story,
                    "tags": scenario_ch.tags or [],
                    "data": scenario_ch.data or {},
                    "icon_url": str(scenario_ch.icon_url) if scenario_ch.icon_url else None,
                    "img_url": str(scenario_ch.img_url) if scenario_ch.img_url else None,
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                }
                if new_char_id == scenario_ch.id:
                    bound_pc = scenario_ch
                else:
                    bound_pc = await db.get(models.PlayerCharacter, new_char_id)

        if bound_pc is not None:
            bound_pc.bound_user_id = user_id

        db_p = models.Player(
            id=uuid.uuid4(),
            game_session_id=gs.id,
            user_id=user_id,
            name=p.name,
            color=getattr(p, "color", None) or "#ffffff",
            icon_url=getattr(p, "icon_url", None),
            img_url=getattr(p, "img_url", None),
            character_source_type=character_source_type,
            character_id=character_id,
            character_snapshot=character_snapshot,
        )
        db.add(db_p)
        players.append(db_p)
    await db.flush()
    return players


async def _init_launched_redis(
    db: AsyncSession,
    *,
    approach: models.GameSession,
    launched: models.Scenario,
    players: list[models.Player],
) -> None:
    entities = await SessionEntityLoader(db).load_snapshot(launched.id)
    in_game_start = launched.scenario_starts_at
    key = f"{LAUNCHED_KEY_PREFIX}:{launched.id}"

    runtime = SessionRuntimeState(
        id=approach.id,
        scenario_id=launched.id,
        rule_id_str=launched.rule_id_str or "",
        name=approach.name,
        created_at=approach.created_at,
        master=scheme.User.model_validate(approach.master),
        players=[scheme.PlayerWithCharacter.model_validate(_convert_player(p)) for p in players],
        polygon_shown=set(),
        seen=set(),
        timeline=SessionTimelineInner(
            scenario_started_at=in_game_start,
            current_time=in_game_start,
        ),
        launched_scenario_id=launched.id,
        approach_session_id=approach.id,
        party_id=approach.party_id,
    )
    await redis_client.json().set(key, Path.root_path(), runtime.model_dump(mode="json"))


async def _resume_launched_redis(
    db: AsyncSession,
    *,
    approach: models.GameSession,
    launched: models.Scenario,
    players: list[models.Player],
) -> None:
    key = f"{LAUNCHED_KEY_PREFIX}:{launched.id}"
    existing = await redis_client.json().get(key)
    if not existing:
        await _init_launched_redis(db, approach=approach, launched=launched, players=players)
        return

    runtime = SessionRuntimeState.model_validate(existing)
    runtime.id = approach.id
    runtime.approach_session_id = approach.id
    runtime.party_id = approach.party_id
    runtime.name = approach.name
    runtime.created_at = approach.created_at
    runtime.master = scheme.User.model_validate(approach.master)
    runtime.players = [
        scheme.PlayerWithCharacter.model_validate(_convert_player(p)) for p in players
    ]
    await redis_client.json().set(key, Path.root_path(), runtime.model_dump(mode="json"))


async def start_approach(
    db: AsyncSession,
    *,
    lobby: scheme.Lobby,
    launched_scenario_id: UUID,
    party_id: UUID | None = None,
    campaign_id: UUID | None = None,
    campaign_step_index: int | None = None,
    prior_session_id: UUID | None = None,
) -> scheme.SessionRedirect:
    launched = await get_launched_scenario(db, launched_scenario_id)
    await assert_no_active_approach(db, launched_scenario_id)

    if party_id is None:
        party = await ensure_default_party(db, launched_scenario_id=launched_scenario_id)
        party_id = party.id
    else:
        party = await db.get(models.ScenarioParty, party_id)
        if not party or party.launched_scenario_id != launched_scenario_id:
            raise ValueError("party does not belong to launched scenario")

    apps_by_id, scenario_chars_by_id = await _load_lobby_character_lookups(db, lobby)

    # Re-attach pool application characters after previous finish_session detach.
    from app.services.application_entity_service import ensure_applications_attached_to_scenario

    await ensure_applications_attached_to_scenario(
        db,
        scenario_id=launched.id,
        apps_by_id=apps_by_id,
    )

    gs = models.GameSession(
        id=uuid.uuid4(),
        scenario_id=launched.id,
        launched_scenario_id=launched.id,
        party_id=party_id,
        name=getattr(lobby, "name", None) or launched.name,
        master_id=UUID(str(lobby.master.id)) if getattr(lobby, "master", None) else None,
        is_active=True,
        campaign_id=campaign_id,
        campaign_step_index=campaign_step_index,
        prior_session_id=prior_session_id,
    )
    db.add(gs)
    await db.flush()

    players = await _build_players_from_lobby(
        db, gs, lobby, id_map=None, apps_by_id=apps_by_id, scenario_chars_by_id=scenario_chars_by_id
    )

    stmt = (
        select(models.GameSession)
        .where(models.GameSession.id == gs.id)
        .options(
            selectinload(models.GameSession.master),
            selectinload(models.GameSession.players).selectinload(models.Player.user),
        )
    )
    gs_db = (await db.execute(stmt)).scalar_one()

    redis_exists = await redis_client.exists(f"{LAUNCHED_KEY_PREFIX}:{launched.id}") == 1
    if redis_exists:
        await _resume_launched_redis(db, approach=gs_db, launched=launched, players=players)
    else:
        await _init_launched_redis(db, approach=gs_db, launched=launched, players=players)

    await db.commit()
    return scheme.SessionRedirect(session_id=gs.id)


async def _patch_runtime_campaign_meta(
    launched_scenario_id: UUID,
    *,
    campaign_id: UUID,
    campaign_step_index: int,
    campaign_name: str,
    campaign_total_steps: int,
) -> None:
    key = f"{LAUNCHED_KEY_PREFIX}:{launched_scenario_id}"
    data = await redis_client.json().get(key)
    if not data:
        return
    runtime = SessionRuntimeState.model_validate(data)
    runtime.campaign_id = campaign_id
    runtime.campaign_step_index = campaign_step_index
    runtime.campaign_name = campaign_name
    runtime.campaign_total_steps = campaign_total_steps
    await redis_client.json().set(key, Path.root_path(), runtime.model_dump(mode="json"))


async def launch_and_start_approach(
    db: AsyncSession,
    *,
    lobby: scheme.Lobby,
    prep_scenario_id: UUID,
    launch_mode: str = "multi_party",
    campaign_id: UUID | None = None,
    campaign_step_index: int | None = None,
    prior_session_id: UUID | None = None,
    campaign_name: str | None = None,
    campaign_total_steps: int | None = None,
    carryover: dict | None = None,
) -> scheme.SessionRedirect:
    apps_by_id, scenario_chars_by_id = await _load_lobby_character_lookups(db, lobby)

    unique_apps = {app.id: app for app in apps_by_id.values()}
    clone_result = await launch_scenario(
        db,
        prep_scenario_id=prep_scenario_id,
        session_name=getattr(lobby, "name", None) or "Session",
        launch_mode=launch_mode,
        application_characters=list(unique_apps.values()) if unique_apps else None,
    )
    launched = clone_result.scenario
    if carryover:
        from app.services.campaign_carryover import apply_carryover_after_clone

        character_id_by_user: dict[str, UUID] = {}
        chars_by_user = carryover.get("characters_by_user") or {}
        id_map = clone_result.id_map or {}
        for user_id_str, ch_data in chars_by_user.items():
            old_id_raw = ch_data.get("id")
            if not old_id_raw:
                continue
            old_id = UUID(str(old_id_raw))
            new_id = id_map.get(old_id, old_id)
            character_id_by_user[user_id_str] = new_id
        await apply_carryover_after_clone(
            db,
            scenario_id=launched.id,
            carryover=carryover,
            character_id_by_user=character_id_by_user,
        )
    party = await ensure_default_party(
        db,
        launched_scenario_id=launched.id,
        filter_tags=["party:default"],
    )
    await assert_no_active_approach(db, launched.id)

    gs = models.GameSession(
        id=uuid.uuid4(),
        scenario_id=launched.id,
        launched_scenario_id=launched.id,
        party_id=party.id,
        name=getattr(lobby, "name", None) or launched.name,
        master_id=UUID(str(lobby.master.id)) if getattr(lobby, "master", None) else None,
        is_active=True,
        campaign_id=campaign_id,
        campaign_step_index=campaign_step_index,
        prior_session_id=prior_session_id,
    )
    db.add(gs)
    await db.flush()

    players = await _build_players_from_lobby(
        db,
        gs,
        lobby,
        id_map=clone_result.id_map,
        apps_by_id=apps_by_id,
        scenario_chars_by_id=scenario_chars_by_id,
    )

    stmt = (
        select(models.GameSession)
        .where(models.GameSession.id == gs.id)
        .options(
            selectinload(models.GameSession.master),
            selectinload(models.GameSession.players).selectinload(models.Player.user),
        )
    )
    gs_db = (await db.execute(stmt)).scalar_one()
    await _init_launched_redis(db, approach=gs_db, launched=launched, players=players)
    if campaign_id is not None:
        await _patch_runtime_campaign_meta(
            launched.id,
            campaign_id=campaign_id,
            campaign_step_index=campaign_step_index or 0,
            campaign_name=campaign_name or "",
            campaign_total_steps=campaign_total_steps or 0,
        )
    await db.commit()
    return scheme.SessionRedirect(session_id=gs.id)


async def close_approach(db: AsyncSession, approach_id: UUID) -> bool:
    gs = await db.get(models.GameSession, approach_id)
    if not gs:
        return False
    launched_id = gs.launched_scenario_id
    if gs.is_active:
        gs.is_active = False
        gs.status = models.GameSessionStatus.finished_ok
        gs.finished_at = datetime.now(timezone.utc)
        await db.commit()
    if launched_id:
        await release_approach_runtime(launched_id, approach_id)
    else:
        await redis_client.delete(f"{SESSION_KEY_PREFIX}:{approach_id}")
    return True


async def release_approach_runtime(
    launched_scenario_id: UUID,
    approach_id: UUID,
) -> None:
    """Detach a finished approach from launched Redis runtime (keep world for resume)."""
    key = f"{LAUNCHED_KEY_PREFIX}:{launched_scenario_id}"
    data = await redis_client.json().get(key)
    if not data:
        return
    try:
        runtime = SessionRuntimeState.model_validate(data)
    except Exception:
        logger.exception("release_approach_runtime: invalid redis payload %s", key)
        return

    current = runtime.approach_session_id or runtime.id
    if str(current) != str(approach_id):
        return

    runtime.players = []
    runtime.approach_session_id = None
    runtime.observers = []
    runtime.actions = []
    # Keep scenes/timeline/logs — next start_approach resumes via _resume_launched_redis.
    await redis_client.json().set(key, Path.root_path(), runtime.model_dump(mode="json"))


async def close_launched_scenario(db: AsyncSession, launched_scenario_id: UUID) -> bool:
    launched = await db.get(models.Scenario, launched_scenario_id)
    if not launched:
        return False
    await assert_no_active_approach(db, launched_scenario_id)
    launched.lifecycle_status = "closed"
    await db.commit()
    await redis_client.delete(f"{LAUNCHED_KEY_PREFIX}:{launched_scenario_id}")
    return True
