from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Select, select, update
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.infrastructure.database import get_async_session as get_db
from app import models, scheme




def crud_stmt_location() -> Select:
    return select(models.Location).options(
            selectinload(models.Location.map_objects),
        )

def crud_stmt_item_scheme() -> Select:
    return select(models.GameItemScheme)


def crud_stmt_item() -> Select:
    return select(models.GameItem)



def crud_stmt_scenario() -> Select:
    """
    Полная загрузка сценария:
    - автор
    - правила: тела, статы, группы навыков, навыки, предметные схемы, формулы, обработчики действий
    - сценарные предметы с использованиями и схемами
    - персонажи и NPC с телами и статами
    - заметки, игровые события
    - локации с объектами, действиями, требованиями, предметами, NPC
    """
    return (
        select(models.Scenario)
        .options(
            # Автор
            selectinload(models.Scenario.user),
            # Правила
            # Предметы сценария (если есть глобальный список)
            selectinload(models.Scenario.items),
            # Персонажи игроков
            selectinload(models.Scenario.characters),
            # NPC сценария (общие, не привязанные к локации)
            selectinload(models.Scenario.npcs),
            # Заметки, события
            selectinload(models.Scenario.notes),
            selectinload(models.Scenario.gametimeevents),
            selectinload(models.Scenario.counters),
            # Локации
            selectinload(models.Scenario.locations)
                .selectinload(models.Location.map_objects),
        )
    )
