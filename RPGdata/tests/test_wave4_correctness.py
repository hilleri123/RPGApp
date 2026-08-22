"""Regression tests for wave 4: silent data loss and blocking IO.

Covers the session manager cache that handed REST and WebSocket two different
Redis keys, set_field dropping writes for half of the entity fields, the IDOR
pattern from BE-11 repeated across every entity router, and the synchronous
file writes inside async upload handlers.
"""

from __future__ import annotations

import importlib
import inspect
import pathlib
import re
import uuid

import pytest
from fastapi import HTTPException


def _module(name: str):
    importlib.import_module("app.main")
    return importlib.import_module(name)


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalars(self):
        return self

    def first(self):
        return self._row


class _RecordingDB:
    def __init__(self, row=None):
        self.row = row
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        return _FakeResult(self.row)

    async def commit(self):
        return None


# --- BE-06: два ключа Redis для одной сессии -------------------------------


def test_session_manager_getitem_is_closed():
    """REST брал менеджер без launched_scenario_id и читал другой документ:
    session_exists() отдавал False для живой сессии."""
    sm = _module("app.managers.session_manager").session_manager

    with pytest.raises(TypeError) as exc:
        sm[str(uuid.uuid4())]
    assert "ensure_manager" in str(exc.value)


def test_rest_routes_use_ensure_manager():
    root = pathlib.Path(_module("app.main").__file__).parent
    # Сам session_manager.py упоминает индексную форму в тексте ошибки.
    definition = root / "managers" / "session_manager.py"
    offenders = [
        str(p.relative_to(root))
        for p in root.rglob("*.py")
        if p != definition and "session_manager[" in p.read_text()
    ]
    assert offenders == [], f"остались обращения через индекс: {offenders}"


def test_finish_session_resolves_manager_asynchronously():
    session = _module("app.routes.websocket.session")
    src = inspect.getsource(session.finish_session)
    assert "await session_manager.ensure_manager(session_id)" in src


# --- BE-15: set_field теряет запись ---------------------------------------


def test_persisted_entity_fields_cover_backed_models():
    """Раньше писались только npcs, characters и items; для локаций, заметок,
    вех и препятствий метод сбрасывал кеш и выходил."""
    dm = _module("app.managers.session.data_manager")

    assert set(dm._PERSISTED_ENTITY_MODELS) >= {
        "npcs", "characters", "items", "locations", "obstacles", "notes", "story_beats",
    }


def test_persisted_models_have_scenario_scope():
    """Запись идёт с фильтром по scenario_id, поэтому колонка обязательна."""
    dm = _module("app.managers.session.data_manager")

    for field, model in dm._PERSISTED_ENTITY_MODELS.items():
        columns = {c.name for c in model.__table__.columns}
        assert "scenario_id" in columns, field


def test_unbacked_fields_are_declared_and_disjoint():
    dm = _module("app.managers.session.data_manager")

    assert dm._UNBACKED_ENTITY_FIELDS
    assert not (set(dm._PERSISTED_ENTITY_MODELS) & dm._UNBACKED_ENTITY_FIELDS)


def test_unbacked_field_write_is_logged_not_silent():
    """Молчаливая потеря хуже ошибки: правка выглядит применённой до
    ближайшего get_inner(), а потом исчезает."""
    dm = _module("app.managers.session.data_manager")
    src = inspect.getsource(dm.SessionDataManager.set_field)

    assert "_UNBACKED_ENTITY_FIELDS" in src
    assert "logger.warning" in src


def test_persist_respects_missing_data_column():
    """У заметок и вех нет колонки data — присваивание создало бы обычный
    атрибут, и запись снова потерялась бы."""
    dm = _module("app.managers.session.data_manager")
    src = inspect.getsource(dm.SessionDataManager._persist_entity_list_to_db)

    assert "columns" in src
    assert '"data" in columns' in src


# --- BE-11 (шире, чем локации): IDOR во всех роутерах сущностей ------------


ENTITY_FILES = {
    "notes.py": "Note",
    "characters.py": "PlayerCharacter",
    "counters.py": "Counter",
    "game_items.py": "GameItem",
    "npcs.py": "NPC",
    "story_beat.py": "StoryBeat",
    "locations.py": "Location",
}


def test_no_entity_lookup_ignores_scenario():
    """Роуты проверяют права на сценарий из запроса, а сущность искали по
    одному id. Ни одна выборка по id не должна остаться без scenario_id."""
    routes_dir = pathlib.Path(_module("app.main").__file__).parent / "routes"
    unscoped: list[str] = []

    for filename, model in ENTITY_FILES.items():
        lines = (routes_dir / filename).read_text().splitlines()
        for i, line in enumerate(lines):
            if not re.search(rf"models\.{model}\.id ==", line):
                continue
            window = "\n".join(lines[max(0, i - 7):i + 8])
            if f"models.{model}.scenario_id" not in window:
                unscoped.append(f"{filename}:{i + 1}")

    assert unscoped == [], f"выборки без скоупа сценария: {unscoped}"


@pytest.mark.parametrize(
    "module_name,helper,model_attr",
    [
        ("app.routes.npcs", "_get_npc_or_404", "NPC"),
        ("app.routes.game_items", "_get_item_or_404", "GameItem"),
        ("app.routes.characters", "_get_character_or_404", "PlayerCharacter"),
    ],
)
@pytest.mark.asyncio
async def test_entity_helper_filters_by_scenario(module_name, helper, model_attr):
    module = _module(module_name)
    db = _RecordingDB(row=None)

    with pytest.raises(HTTPException) as exc:
        await getattr(module, helper)(db, uuid.uuid4(), uuid.uuid4())
    assert exc.value.status_code == 404

    where = str(db.statements[0])
    assert "scenario_id" in where


def test_note_checked_flag_compared_by_value():
    """`k is "is_checked"` работал лишь случайно, на интернировании строк."""
    notes = _module("app.routes.notes")
    src = inspect.getsource(notes)

    assert 'if k is "is_checked"' not in src
    assert 'if k == "is_checked"' in src


# --- BE-19: блокирующая запись файлов -------------------------------------


def test_uploads_do_not_block_event_loop():
    """Синхронная запись внутри async def подвешивает все WebSocket-соединения
    сервера на время загрузки."""
    s3 = _module("app.infrastructure.s3_service")
    src = pathlib.Path(s3.__file__).read_text()

    assert "await asyncio.to_thread(dest.write_bytes, content)" in src
    # Ни одной прямой синхронной записи не осталось.
    assert not re.search(r"^\s*dest\.write_bytes\(", src, re.MULTILINE)


def test_directory_cleanup_moved_off_loop():
    s3 = _module("app.infrastructure.s3_service")
    src = pathlib.Path(s3.__file__).read_text()

    assert "asyncio.to_thread(_cleanup_old_versions" in src
    assert not re.search(r"^\s{4}_cleanup_old_versions\(", src, re.MULTILINE)


@pytest.mark.asyncio
async def test_upload_writes_file_through_thread(tmp_path, monkeypatch):
    """Проверяем не только форму вызова, но и что файл реально появляется."""
    s3 = _module("app.infrastructure.s3_service")
    monkeypatch.setattr(s3, "MEDIA_ROOT", tmp_path)

    class _FakeUpload:
        filename = "map.png"

        async def read(self):
            return b"payload"

    url = await s3.upload_file(_FakeUpload(), "location/1", name="map")

    written = list((tmp_path / "location/1").iterdir())
    assert len(written) == 1
    assert written[0].read_bytes() == b"payload"
    assert written[0].name.startswith("map_") and url.endswith(written[0].name)
