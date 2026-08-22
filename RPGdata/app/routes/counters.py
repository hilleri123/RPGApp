# app/routes/scenarios/counters.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.infrastructure.database import get_async_session as get_db
from app import models, scheme
from app.auth import require_master
from app.routes._helpers import get_scenario_or_404, get_scenario_edit, notify_active_sessions_for_scenario
from app.services.scenario_entities import counters as counters_service

router = APIRouter(prefix="/scenarios/{scenario_id}/counters", tags=["counters"])


async def _get_counter_or_404(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    counter_id: UUID,
) -> models.Counter:
    result = await db.execute(
        select(models.Counter)
        .where(models.Counter.scenario_id == scenario_id)
        .where(models.Counter.id == counter_id)
    )
    counter = result.scalars().first()
    if not counter:
        raise HTTPException(status_code=404, detail="Счётчик не найден")
    return counter


@router.get("", response_model=list[scheme.Counter])
async def list_counters(
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models.Counter).where(models.Counter.scenario_id == scenario.id)
    )
    return res.scalars().all()


@router.get("/{counter_id}", response_model=scheme.Counter)
async def get_by_id(
    counter_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await _get_counter_or_404(db, scenario_id=scenario.id, counter_id=counter_id)


@router.post("", response_model=scheme.Counter)
async def create_counter(
    counter_in: scheme.CounterCreate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Проверка сценария
    res = await db.execute(select(models.Scenario).where(models.Scenario.id == scenario.id))
    if not res.scalars().first():
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    # Можно опционально проверить character_id принадлежность сценарию
    if counter_in.character_id:
        res = await db.execute(
            select(models.PlayerCharacter).where(
                models.PlayerCharacter.id == counter_in.character_id,
                models.PlayerCharacter.scenario_id == scenario.id,
            )
        )
        if not res.scalars().first():
            raise HTTPException(status_code=400, detail="Персонаж не принадлежит сценарию")

    db_counter = models.Counter(
        **counter_in.model_dump(),
        scenario_id=scenario.id,
    )
    db.add(db_counter)
    await db.commit()
    await db.refresh(db_counter)
    await notify_active_sessions_for_scenario(db, scenario, ["counters"])
    return db_counter


@router.put("/{counter_id}", response_model=scheme.Counter)
async def update_counter(
    counter_id: UUID,
    counter_in: scheme.CounterCreate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Зависимости роутов проверяют права на сценарий из запроса, а не на
    # сущность. Без фильтра по scenario_id мастер сценария A правил бы
    # сущность сценария B, подставив свой scenario_id и чужой id.
    db_counter = await _get_counter_or_404(db, scenario_id=scenario.id, counter_id=counter_id)

    # если меняется character_id, можно тоже проверить принадлежность
    data = counter_in.model_dump(exclude_unset=True)
    if "character_id" in data and data["character_id"] is not None:
        res = await db.execute(
            select(models.PlayerCharacter).where(
                models.PlayerCharacter.id == data["character_id"]
            )
        )
        if not res.scalars().first():
            raise HTTPException(status_code=400, detail="Персонаж не принадлежит сценарию")

    old_value = int(db_counter.value or 0)
    new_value_in_payload = "value" in data
    for k, v in data.items():
        if k == "value":
            continue
        setattr(db_counter, k, v)
    if new_value_in_payload:
        db_counter.value = counters_service.clamp_counter_value(db_counter, int(data["value"]))
        new_value = int(db_counter.value or 0)
        await counters_service.record_counter_change(
            db,
            counter=db_counter,
            old_value=old_value,
            new_value=new_value,
            comment=None,
            user_id=getattr(current_user, "id", None),
        )

    await db.commit()
    await db.refresh(db_counter)
    await notify_active_sessions_for_scenario(db, scenario, ["counters"])
    return db_counter


@router.post("/{counter_id}/adjust", response_model=scheme.Counter)
async def adjust_counter(
    counter_id: UUID,
    body: scheme.CounterAdjust,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    db_counter = await _get_counter_or_404(db, scenario_id=scenario.id, counter_id=counter_id)
    comment = (body.comment or "").strip() or None
    updated, _change = await counters_service.adjust_counter(
        db,
        counter=db_counter,
        delta=int(body.delta),
        comment=comment,
        user_id=getattr(current_user, "id", None),
    )
    await notify_active_sessions_for_scenario(db, scenario, ["counters"])
    return updated


@router.get("/{counter_id}/history", response_model=list[scheme.CounterChange])
async def get_counter_history(
    counter_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _get_counter_or_404(db, scenario_id=scenario.id, counter_id=counter_id)
    return await counters_service.list_counter_history(db, counter_id=counter_id, limit=limit)


@router.delete("/{counter_id}", status_code=204)
async def delete_counter(
    counter_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    db_counter = await _get_counter_or_404(db, scenario_id=scenario.id, counter_id=counter_id)

    from app.services.entity_lineage_service import assert_launched_entity_deletable

    try:
        assert_launched_entity_deletable(scenario, db_counter)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await db.delete(db_counter)
    await db.commit()
    await notify_active_sessions_for_scenario(db, scenario, ["counters"])
    return
