from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme
from app.auth import get_current_user
from app.infrastructure.database import get_async_session as get_db
from app.services.launched_scenario_service import (
    ConcurrentApproachError,
    LaunchedScenarioClosedError,
    assert_no_active_approach,
    close_launched_scenario,
    ensure_default_party,
    get_active_approach_session_id,
    get_launched_scenario,
    launch_scenario,
)

router = APIRouter(prefix="/launched-scenarios", tags=["launched-scenarios"])


@router.get("")
async def list_launched_scenarios(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models.Scenario)
        .where(
            models.Scenario.is_session_snapshot == True,
            models.Scenario.lifecycle_status == "running",
            models.Scenario.user_id == current_user.id,
        )
        .order_by(models.Scenario.created.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    out: list[scheme.LaunchedScenarioOut] = []
    for s in rows:
        item = scheme.LaunchedScenarioOut.model_validate(s)
        item.active_approach_session_id = await get_active_approach_session_id(db, s.id)
        out.append(item)
    return out


@router.get("/{launched_scenario_id}")
async def get_launched_scenario_detail(
    launched_scenario_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    launched = await get_launched_scenario(db, launched_scenario_id)
    if launched.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="forbidden")
    prep = None
    if launched.source_scenario_id:
        prep = await db.get(models.Scenario, launched.source_scenario_id)
    return {
        "launched": scheme.LaunchedScenarioOut.model_validate(launched),
        "prep_scenario": scheme.Scenario.model_validate(prep) if prep else None,
    }


@router.post("/launch")
async def launch_prep_scenario(
    payload: scheme.LaunchScenarioIn,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prep = await db.get(models.Scenario, payload.prep_scenario_id)
    if not prep or prep.is_session_snapshot:
        raise HTTPException(status_code=404, detail="prep scenario not found")
    if prep.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="forbidden")

    clone_result = await launch_scenario(
        db,
        prep_scenario_id=payload.prep_scenario_id,
        session_name=payload.name or prep.name,
        launch_mode=payload.launch_mode,
    )
    party = await ensure_default_party(db, launched_scenario_id=clone_result.scenario.id)
    await db.commit()
    return {
        "launched_scenario": scheme.LaunchedScenarioOut.model_validate(clone_result.scenario),
        "default_party": scheme.ScenarioPartyOut.model_validate(party),
    }


@router.get("/{launched_scenario_id}/parties")
async def list_parties(
    launched_scenario_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    launched = await get_launched_scenario(db, launched_scenario_id)
    if launched.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="forbidden")
    stmt = (
        select(models.ScenarioParty)
        .where(models.ScenarioParty.launched_scenario_id == launched_scenario_id)
        .order_by(models.ScenarioParty.sort_order)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [scheme.ScenarioPartyOut.model_validate(p) for p in rows]


@router.post("/{launched_scenario_id}/parties")
async def create_party(
    launched_scenario_id: UUID,
    payload: scheme.ScenarioPartyCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    launched = await get_launched_scenario(db, launched_scenario_id)
    if launched.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="forbidden")
    party = models.ScenarioParty(
        launched_scenario_id=launched_scenario_id,
        name=payload.name,
        filter_tags=payload.filter_tags,
        sort_order=payload.sort_order,
    )
    db.add(party)
    await db.commit()
    await db.refresh(party)
    return scheme.ScenarioPartyOut.model_validate(party)


@router.post("/{launched_scenario_id}/close")
async def close_launched(
    launched_scenario_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    launched = await db.get(models.Scenario, launched_scenario_id)
    if not launched or not launched.is_session_snapshot:
        raise HTTPException(status_code=404, detail="not found")
    if launched.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        await assert_no_active_approach(db, launched_scenario_id)
    except ConcurrentApproachError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    ok = await close_launched_scenario(db, launched_scenario_id)
    return {"ok": ok}
