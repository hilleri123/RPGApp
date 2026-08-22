"""Кто из групп что видит: связка группа ↔ сценарий.

Доступ к системам правил по группам раньше жил здесь же, но опирался на модель
MasterGroupRuleAccess, которой нет ни в app/models, ни в базе, а ключом брал
rule_id: UUID, тогда как сценарий ссылается на систему правил строкой rule_id_str.
Эндпоинты убраны как нерабочие — см. задачу «Группы доступа: эндпоинты доступа
к правилам мертвы».
"""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload, aliased
from app.auth.role import get_max_permission_for_user
from app.auth.permissions import get_scenario_permission, can_delete_scenario
from app.infrastructure.database import get_async_session as get_db
from app import models, scheme
from app.auth import require_admin, require_master, get_current_user

router = APIRouter(prefix="/access_groups", tags=["access_control"])

_VALID_PERMS = {p.value for p in scheme.RoleAccess}


async def _scenario_for_sharing(
    db: AsyncSession,
    user: models.User,
    scenario_id: UUID,
) -> models.Scenario:
    """Раздавать доступ к сценарию может тот, у кого на него полные права:
    владелец, администратор или участник группы с уровнем all."""
    scenario = await db.get(models.Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    perm = await get_scenario_permission(db, user, scenario)
    if not can_delete_scenario(perm):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Управлять доступом к сценарию может только его владелец",
        )
    return scenario


@router.get("/{group_id}/scenarios", response_model=List[scheme.MasterGroupScenarioAccess])
async def get_group_scenarios(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    """Сценарии, открытые группе, — обратный разрез для карточки группы."""
    group = await db.get(models.MasterGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    rows = (
        await db.execute(
            select(models.MasterGroupScenarioAccess, models.Scenario)
            .join(
                models.Scenario,
                models.Scenario.id == models.MasterGroupScenarioAccess.scenario_id,
            )
            .where(
                models.MasterGroupScenarioAccess.master_group_id == group_id,
                models.Scenario.is_session_snapshot == False,  # noqa: E712
            )
            .order_by(models.Scenario.name)
        )
    ).all()

    return [
        scheme.MasterGroupScenarioAccess(
            master_group_id=group_id,
            scenario_id=scenario.id,
            permission=access.permission,
            scenario_name=scenario.name,
        )
        for access, scenario in rows
    ]


@router.get("/scenarios/{scenario_id}/groups", response_model=List[scheme.MasterGroupScenarioAccess])
async def get_scenario_with_groups_and_rights(
    scenario_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_master),
):
    """Все группы и их права на указанный сценарий. Группы без доступа
    возвращаются с permission = none, чтобы диалог мог показать полный список."""
    await _scenario_for_sharing(db, current_user, scenario_id)

    m_access = aliased(models.MasterGroupScenarioAccess)

    stmt = (
        select(models.MasterGroup, m_access)
        .outerjoin(
            m_access,
            (m_access.master_group_id == models.MasterGroup.id)
            & (m_access.scenario_id == scenario_id)
        )
        .options(selectinload(models.MasterGroup.users))
        .order_by(models.MasterGroup.name)
    )

    result = await db.execute(stmt)
    items = result.all()

    response = []
    for group, access in items:
        response.append(
            scheme.MasterGroupScenarioAccess(
                master_group_id=group.id,
                scenario_id=scenario_id,
                permission=getattr(access, "permission", None) or "none",
                master_group=scheme.MasterGroup.model_validate(group),
            )
        )

    return response


@router.post("/scenarios/{scenario_id}/groups", response_model=scheme.MasterGroupScenarioAccess)
async def set_scenario_group_access(
    scenario_id: UUID,
    data: scheme.MasterGroupScenarioAccess,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_master),
):
    await _scenario_for_sharing(db, current_user, scenario_id)

    group = await db.get(models.MasterGroup, data.master_group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    if data.permission not in _VALID_PERMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый уровень прав: {data.permission}",
        )

    await db.execute(
        delete(models.MasterGroupScenarioAccess)
        .where(models.MasterGroupScenarioAccess.scenario_id == scenario_id)
        .where(models.MasterGroupScenarioAccess.master_group_id == data.master_group_id)
    )

    # none означает «доступа нет» — записи в таблице для этого не нужно.
    if data.permission == scheme.RoleAccess.NONE_ROLE.value:
        await db.commit()
        return scheme.MasterGroupScenarioAccess(
            master_group_id=data.master_group_id,
            scenario_id=scenario_id,
            permission=scheme.RoleAccess.NONE_ROLE.value,
            master_group=scheme.MasterGroup.model_validate(group),
        )

    access = models.MasterGroupScenarioAccess(
        scenario_id=scenario_id,
        master_group_id=data.master_group_id,
        permission=data.permission
    )
    db.add(access)
    await db.commit()

    await db.refresh(access, attribute_names=["master_group"])
    await db.refresh(access.master_group, attribute_names=["users"])

    return scheme.MasterGroupScenarioAccess.model_validate(access, from_attributes=True)


@router.delete("/scenarios/{scenario_id}/groups/{group_id}")
async def delete_scenario_group_access(
    scenario_id: UUID,
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_master),
):
    await _scenario_for_sharing(db, current_user, scenario_id)

    stmt = delete(models.MasterGroupScenarioAccess).where(
        models.MasterGroupScenarioAccess.scenario_id == scenario_id,
        models.MasterGroupScenarioAccess.master_group_id == group_id
    )
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Право не найдено")
    return {"message": "Доступ удалён"}


@router.get("/scenarios/{scenario_id}/max_perm")
async def get_scenario_user_max_permission(
    scenario_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Свой собственный уровень доступа к сценарию — только по группам, без учёта владения."""
    perm = await get_max_permission_for_user(db, current_user, "scenario", scenario_id)
    return {"max_permission": perm}
