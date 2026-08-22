import uuid
from typing import Tuple, Optional
from datetime import datetime, timezone

from sqlalchemy import select

from app import models, scheme
from app.models.scenario.todo import TodoElementType, TodoPriority
from app.infrastructure.database import get_async_session as get_db
from .data_manager import SessionDataManager


class SessionTODOManager(SessionDataManager):
    def __init__(self, session_id: uuid.UUID):
        super().__init__(str(session_id))

    async def _get_scenario_id(self) -> uuid.UUID:
        return await self.get_scenario_id()

    async def add_todo(
        self,
        user: models.User,
        text: str,
        element_type: TodoElementType = TodoElementType.location,
        element_id: uuid.UUID = None,
        element_name: str = None,
        note: str = None,
        priority: str = "medium",
    ) -> Tuple[bool, list[str]]:
        scenario_id = await self._get_scenario_id()
        async for db in get_db():
            db_obj = models.ScenarioTodo(
                scenario_id=scenario_id,
                element_type=element_type,
                element_id=element_id,
                element_name=element_name,
                text=text,
                note=note,
                priority=TodoPriority(priority),
                is_done=False,
            )
            db.add(db_obj)
            await db.commit()

        await self.invalidate_entity_cache()
        return True, ["todos"]

    async def toggle_todo(
        self,
        user: models.User,
        todo_id: str,
        done: bool,
    ) -> Tuple[bool, list[str]]:
        scenario_id = await self._get_scenario_id()
        done_at = datetime.now(timezone.utc) if done else None

        async for db in get_db():
            obj = (await db.execute(
                select(models.ScenarioTodo).where(
                    models.ScenarioTodo.id == uuid.UUID(todo_id),
                    models.ScenarioTodo.scenario_id == scenario_id,
                )
            )).scalars().first()
            if not obj:
                return False, []
            obj.is_done = done
            obj.done_at = done_at
            await db.commit()

        await self.invalidate_entity_cache()
        return True, ["todos"]

    async def patch_todo(
        self,
        user: models.User,
        todo_id: str,
        payload: scheme.ScenarioTodoPatch,
    ) -> Tuple[bool, list[str]]:
        scenario_id = await self._get_scenario_id()
        update = payload.model_dump(exclude_unset=True)

        async for db in get_db():
            obj = (await db.execute(
                select(models.ScenarioTodo).where(
                    models.ScenarioTodo.id == uuid.UUID(todo_id),
                    models.ScenarioTodo.scenario_id == scenario_id,
                )
            )).scalars().first()
            if not obj:
                return False, []
            db_update = dict(update)
            if db_update.get("is_done") is True and not obj.is_done:
                db_update["done_at"] = datetime.now(timezone.utc)
            elif db_update.get("is_done") is False:
                db_update["done_at"] = None
            for k, v in db_update.items():
                setattr(obj, k, v)
            await db.commit()

        await self.invalidate_entity_cache()
        return True, ["todos"]

    async def delete_todo(
        self,
        user: models.User,
        todo_id: str,
    ) -> Tuple[bool, list[str]]:
        scenario_id = await self._get_scenario_id()

        async for db in get_db():
            obj = (await db.execute(
                select(models.ScenarioTodo).where(
                    models.ScenarioTodo.id == uuid.UUID(todo_id),
                    models.ScenarioTodo.scenario_id == scenario_id,
                )
            )).scalars().first()
            if not obj:
                return False, []
            await db.delete(obj)
            await db.commit()

        await self.invalidate_entity_cache()
        return True, ["todos"]

    async def get_todos(
        self,
        element_type: str = None,
        element_id: str = None,
    ) -> list[dict]:
        inner = await self.get_inner()
        todos = [t.model_dump(mode="json") if hasattr(t, "model_dump") else t for t in (inner.todos or [])]
        if element_type:
            todos = [t for t in todos if t.get("element_type") == element_type]
        if element_id:
            todos = [t for t in todos if t.get("element_id") == element_id]
        return todos
