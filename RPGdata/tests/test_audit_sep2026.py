"""Регрессии по аудиту от 2026-09-30.

1. obstacle_manager брал список из `inner.counters` и записывал его как
   препятствия.
2. PUT /counters/{id} проверял персонажа без скоупа сценария.
3. Удаление и правка счётчика из сессии искали запись только по id.
"""

from __future__ import annotations

import importlib
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalars(self):
        return self

    def first(self):
        return self._row


class _SequenceDB:
    """Отдаёт строки по очереди и запоминает выражения."""

    def __init__(self, *rows):
        self.rows = list(rows)
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        row = self.rows.pop(0) if self.rows else None
        return _FakeResult(row)

    async def commit(self):
        return None

    async def delete(self, obj):
        return None

    async def refresh(self, obj):
        return None


def _module(name: str):
    # Модули менеджеров циклически зависят друг от друга: как и в остальных
    # тестах, сначала поднимаем приложение целиком.
    importlib.import_module("app.main")
    return importlib.import_module(name)


def _sql(stmt) -> str:
    return str(stmt.compile(compile_kwargs={"literal_binds": False}))


# --- 1. препятствия --------------------------------------------------------


@pytest.mark.asyncio
async def test_obstacle_upsert_uses_obstacles_not_counters():
    from app import scheme

    module = _module("app.managers.session.obstacle_manager")

    existing = scheme.ObstacleOut(id=uuid.uuid4(), name="старое", data={}, tags=[])
    new = scheme.ObstacleOut(id=uuid.uuid4(), name="новое", data={}, tags=[])
    # Если код по-прежнему читает counters, эти маркеры попадут в запись.
    counter_marker = SimpleNamespace(
        id=uuid.uuid4(),
        model_dump=lambda mode="json": {"id": "COUNTER"},
    )

    written = {}

    manager = module.SessionObstacleManager.__new__(module.SessionObstacleManager)

    async def get_inner():
        return SimpleNamespace(obstacles=[existing], counters=[counter_marker])

    async def set_field(field, value):
        written[field] = value

    manager.get_inner = get_inner
    manager.set_field = set_field

    found = await manager._upsert_obstacle_in_inner(new)

    assert found is False
    ids = [item["id"] for item in written["obstacles"]]
    assert "COUNTER" not in ids
    assert ids == [str(existing.id), str(new.id)]


# --- 2. PUT /counters ------------------------------------------------------


@pytest.mark.asyncio
async def test_update_counter_checks_character_inside_scenario():
    counters = _module("app.routes.counters")
    from app import scheme

    scenario_id = uuid.uuid4()
    counter = SimpleNamespace(id=uuid.uuid4(), scenario_id=scenario_id, value=0)
    # первая выборка — сам счётчик, вторая — персонаж (чужой -> не найден)
    db = _SequenceDB(counter, None)

    payload = scheme.CounterCreate.model_validate(
        {"name": "x", "value": 1, "character_id": str(uuid.uuid4())}
    )

    with pytest.raises(HTTPException) as exc:
        await counters.update_counter(
            counter_id=counter.id,
            counter_in=payload,
            scenario=SimpleNamespace(id=scenario_id),
            current_user=SimpleNamespace(id=uuid.uuid4()),
            db=db,
        )

    assert exc.value.status_code == 400
    character_lookup = _sql(db.statements[1])
    assert "player_character.scenario_id" in character_lookup


# --- 3. счётчики внутри сессии ---------------------------------------------


@pytest.mark.asyncio
async def test_counter_service_filters_by_scenario_when_given():
    service = _module("app.services.scenario_entities.counters")

    scenario_id = uuid.uuid4()

    db = _SequenceDB(None)
    assert await service.delete_counter(db, counter_id=uuid.uuid4(), scenario_id=scenario_id) is False
    assert "counter.scenario_id" in _sql(db.statements[0])

    db = _SequenceDB(None)
    result = await service.update_counter_value(
        db, counter_id=uuid.uuid4(), value=3, scenario_id=scenario_id
    )
    assert result is None
    assert "counter.scenario_id" in _sql(db.statements[0])


@pytest.mark.asyncio
async def test_session_counter_actions_pass_session_scenario():
    note_manager = _module("app.managers.session.note_manager")

    scenario_id = uuid.uuid4()
    seen = {}

    async def fake_with_db(fn):
        db = _SequenceDB(None)
        result = await fn(db)
        seen["sql"] = _sql(db.statements[0])
        return result

    async def get_scenario_id():
        return scenario_id

    async def invalidate():
        return None

    manager = note_manager.SessionNoteManager.__new__(note_manager.SessionNoteManager)
    manager.get_scenario_id = get_scenario_id
    manager.invalidate_entity_cache = invalidate

    original = note_manager.with_db
    note_manager.with_db = fake_with_db
    try:
        ok, _ = await manager.delete_counter(SimpleNamespace(), uuid.uuid4())
        assert ok is False
        assert "counter.scenario_id" in seen["sql"]

        seen.clear()
        ok, _ = await manager.change_counter_value(SimpleNamespace(), uuid.uuid4(), 5)
        assert ok is False
        assert "counter.scenario_id" in seen["sql"]
    finally:
        note_manager.with_db = original
