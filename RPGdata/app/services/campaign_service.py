"""Campaign lifecycle: CRUD, session start, carryover."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.infrastructure.database import get_async_session as get_db
from app.logger import logger

from app.services.campaign_carryover import export_carryover_from_inner


async def _load_campaign(db: AsyncSession, campaign_id: UUID) -> Optional[models.Campaign]:
    stmt = (
        select(models.Campaign)
        .where(models.Campaign.id == campaign_id)
        .options(
            selectinload(models.Campaign.scenario_links).selectinload(models.CampaignScenario.scenario),
        )
    )
    return (await db.execute(stmt)).scalars().first()


def _campaign_to_out(campaign: models.Campaign) -> scheme.CampaignOut:
    links = sorted(campaign.scenario_links or [], key=lambda x: x.order_num)
    scenarios = [
        scheme.CampaignScenarioOut(
            id=link.id,
            scenario_id=link.scenario_id,
            order_num=link.order_num,
            title_override=link.title_override,
            scenario_name=getattr(link.scenario, "name", None),
        )
        for link in links
    ]
    has_carryover = bool(campaign.carryover_state)
    can_continue = (
        campaign.is_active
        and bool(links)
        and campaign.current_step_index < len(links)
        and has_carryover
    )
    return scheme.CampaignOut(
        id=campaign.id,
        name=campaign.name,
        description=campaign.description,
        master_id=campaign.master_id,
        rule_id_str=campaign.rule_id_str,
        current_step_index=campaign.current_step_index,
        is_active=campaign.is_active,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        scenarios=scenarios,
        has_carryover=has_carryover,
        can_continue=can_continue,
        prep_scenario_id=campaign.prep_scenario_id,
        launched_scenario_id=campaign.launched_scenario_id,
    )


async def list_campaigns(db: AsyncSession, master_id: UUID) -> List[scheme.CampaignOut]:
    stmt = (
        select(models.Campaign)
        .where(models.Campaign.master_id == master_id)
        .options(selectinload(models.Campaign.scenario_links).selectinload(models.CampaignScenario.scenario))
        .order_by(models.Campaign.updated_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_campaign_to_out(c) for c in rows]


async def get_campaign(db: AsyncSession, campaign_id: UUID, master_id: UUID) -> Optional[scheme.CampaignOut]:
    campaign = await _load_campaign(db, campaign_id)
    if not campaign or campaign.master_id != master_id:
        return None
    return _campaign_to_out(campaign)


async def create_campaign(
    db: AsyncSession,
    *,
    master_id: UUID,
    payload: scheme.CampaignCreate,
) -> scheme.CampaignOut:
    campaign = models.Campaign(
        id=uuid.uuid4(),
        name=payload.name,
        description=payload.description,
        master_id=master_id,
        rule_id_str=payload.rule_id_str,
        current_step_index=0,
        is_active=True,
    )
    db.add(campaign)
    await db.flush()
    if payload.scenarios:
        first = sorted(payload.scenarios, key=lambda x: x.order_num)[0]
        campaign.prep_scenario_id = first.scenario_id
    for link in payload.scenarios:
        db.add(
            models.CampaignScenario(
                campaign_id=campaign.id,
                scenario_id=link.scenario_id,
                order_num=link.order_num,
                title_override=link.title_override,
            )
        )
    await db.commit()
    campaign = await _load_campaign(db, campaign.id)
    return _campaign_to_out(campaign)


async def update_campaign(
    db: AsyncSession,
    *,
    campaign_id: UUID,
    master_id: UUID,
    payload: scheme.CampaignUpdate,
) -> Optional[scheme.CampaignOut]:
    campaign = await _load_campaign(db, campaign_id)
    if not campaign or campaign.master_id != master_id:
        return None

    if payload.name is not None:
        campaign.name = payload.name
    if payload.description is not None:
        campaign.description = payload.description
    if payload.rule_id_str is not None:
        campaign.rule_id_str = payload.rule_id_str
    if payload.current_step_index is not None:
        campaign.current_step_index = payload.current_step_index
    if payload.is_active is not None:
        campaign.is_active = payload.is_active

    if payload.scenarios is not None:
        for old in list(campaign.scenario_links or []):
            await db.delete(old)
        await db.flush()
        for link in payload.scenarios:
            db.add(
                models.CampaignScenario(
                    campaign_id=campaign.id,
                    scenario_id=link.scenario_id,
                    order_num=link.order_num,
                    title_override=link.title_override,
                )
            )
        if not campaign.launched_scenario_id:
            links = sorted(payload.scenarios, key=lambda x: x.order_num)
            if links:
                step = min(campaign.current_step_index, len(links) - 1)
                campaign.prep_scenario_id = links[step].scenario_id

    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()
    campaign = await _load_campaign(db, campaign.id)
    return _campaign_to_out(campaign)


async def delete_campaign(db: AsyncSession, campaign_id: UUID, master_id: UUID) -> bool:
    campaign = await db.get(models.Campaign, campaign_id)
    if not campaign or campaign.master_id != master_id:
        return False
    await db.delete(campaign)
    await db.commit()
    return True


def _resolve_step(campaign: models.Campaign, step_index: Optional[int]) -> int:
    idx = campaign.current_step_index if step_index is None else step_index
    links = sorted(campaign.scenario_links or [], key=lambda x: x.order_num)
    if idx < 0 or idx >= len(links):
        raise ValueError(f"campaign step out of range: {idx}")
    return idx


def _character_id_from_carryover(carryover: dict | None, user_id: UUID) -> UUID | None:
    if not carryover:
        return None
    ch = (carryover.get("characters_by_user") or {}).get(str(user_id))
    if not ch or not ch.get("id"):
        return None
    try:
        return UUID(str(ch["id"]))
    except (ValueError, TypeError):
        return None


async def create_campaign_session(
    db: AsyncSession,
    *,
    campaign: models.Campaign,
    lobby: scheme.Lobby,
    step_index: Optional[int] = None,
    prior_session_id: Optional[UUID] = None,
) -> scheme.SessionRedirect:
    from app.services.launched_scenario_service import (
        launch_and_start_approach,
        start_approach,
        _patch_runtime_campaign_meta,
    )

    idx = _resolve_step(campaign, step_index)
    links = sorted(campaign.scenario_links or [], key=lambda x: x.order_num)
    prep_id = links[idx].scenario_id
    session_name = getattr(lobby, "name", None) or campaign.name
    total_steps = len(links)
    carryover = campaign.carryover_state if campaign.current_step_index > 0 else None

    if campaign.launched_scenario_id:
        redirect = await start_approach(
            db,
            lobby=lobby,
            launched_scenario_id=campaign.launched_scenario_id,
            campaign_id=campaign.id,
            campaign_step_index=idx,
            prior_session_id=prior_session_id,
        )
        await _patch_runtime_campaign_meta(
            campaign.launched_scenario_id,
            campaign_id=campaign.id,
            campaign_step_index=idx,
            campaign_name=campaign.name,
            campaign_total_steps=total_steps,
        )
        return redirect

    redirect = await launch_and_start_approach(
        db,
        lobby=lobby,
        prep_scenario_id=prep_id,
        campaign_id=campaign.id,
        campaign_step_index=idx,
        prior_session_id=prior_session_id,
        campaign_name=campaign.name,
        campaign_total_steps=total_steps,
        carryover=carryover,
    )
    gs = await db.get(models.GameSession, redirect.session_id)
    if gs:
        campaign.launched_scenario_id = gs.launched_scenario_id
        campaign.prep_scenario_id = prep_id
        await db.commit()
    return redirect


async def save_campaign_carryover(
    db: AsyncSession,
    *,
    campaign_id: UUID,
    inner: Any,
    finished_step_index: int,
    advance_step: bool = True,
) -> scheme.CampaignSessionFinishOut:
    campaign = await _load_campaign(db, campaign_id)
    if not campaign:
        raise ValueError("campaign not found")

    carryover = export_carryover_from_inner(inner)
    campaign.carryover_state = carryover
    campaign.updated_at = datetime.now(timezone.utc)

    links = sorted(campaign.scenario_links or [], key=lambda x: x.order_num)
    next_idx = finished_step_index + 1 if advance_step else finished_step_index
    if advance_step:
        campaign.current_step_index = min(next_idx, len(links))

    await db.flush()

    has_next = next_idx < len(links)
    return scheme.CampaignSessionFinishOut(
        ok=True,
        campaign_id=campaign.id,
        finished_step_index=finished_step_index,
        next_step_index=next_idx if has_next else None,
        has_next=has_next,
        carryover_saved=True,
    )


async def get_profile(db: AsyncSession, user_id: UUID) -> scheme.CampaignProfileOut:
    as_master = await list_campaigns(db, user_id)

    from sqlalchemy.orm import selectinload

    stmt = (
        select(models.GameSession)
        .options(
            selectinload(models.GameSession.campaign).selectinload(models.Campaign.scenario_links),
            selectinload(models.GameSession.players),
        )
        .where(
            (models.GameSession.master_id == user_id)
            | models.GameSession.players.any(models.Player.user_id == user_id)
        )
        .order_by(models.GameSession.created_at.desc())
        .limit(100)
    )
    sessions = list((await db.execute(stmt)).scalars().all())

    history: List[scheme.CampaignSessionHistoryItem] = []
    for gs in sessions:
        role = "master" if gs.master_id == user_id else "player"
        campaign = gs.campaign
        total_steps = len(campaign.scenario_links or []) if campaign else None
        history.append(
            scheme.CampaignSessionHistoryItem(
                session_id=gs.id,
                session_name=gs.name,
                campaign_id=gs.campaign_id,
                campaign_name=campaign.name if campaign else None,
                step_index=gs.campaign_step_index,
                total_steps=total_steps,
                created_at=gs.created_at,
                finished_at=gs.finished_at,
                role=role,
                is_active=bool(gs.is_active),
            )
        )

    return scheme.CampaignProfileOut(as_master=as_master, session_history=history)
