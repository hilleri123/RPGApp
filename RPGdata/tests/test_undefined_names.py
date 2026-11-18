"""Пути, где код обращался к имени, которого нет: NameError вместо ответа."""

from __future__ import annotations

import importlib
from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from plugins.common.types import ActionContext, ActionParticipants, Links, SceneContext


def test_item_reader_and_campaign_route_import_what_they_call():
    items = importlib.import_module("app.services.scenario_entities.items")
    campaigns = importlib.import_module("app.routes.campaigns")
    assert callable(items.selectinload)
    assert callable(campaigns._character_id_from_carryover)


def test_gumshoe_attack_refuses_player_without_character():
    from plugins.gumshoe.base.backend.workflows.attack.workflow import AttackWorkflow

    gm, player = uuid4(), uuid4()
    ctx = ActionContext(
        scene=SceneContext(id=uuid4(), name="s", data={}, characters=[]),
        players=[],
        links=Links(characterToUserId={}),
        actorUserId=player,
        participants=ActionParticipants(gmUserId=gm, participants=[player, gm]),
        actionKey="gumshoe.attack",
    )
    result = AttackWorkflow(SimpleNamespace()).start(ctx)
    assert result.ok is False


@pytest.mark.asyncio
async def test_transcribe_marks_segment_error_when_recognition_fails(monkeypatch):
    from app.services import table_asr

    segment = SimpleNamespace(file_path="a.ogg", status="transcribing", error=None)

    class _Db:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def execute(self, _stmt):
            return SimpleNamespace(rowcount=1)

        async def commit(self):
            return None

        async def get(self, _model, _id):
            return segment

    def recognize(_path):
        raise RuntimeError("speechkit down")

    monkeypatch.setattr(table_asr, "AsyncSessionLocal", lambda: _Db())
    monkeypatch.setattr(table_asr, "recognize_file", recognize)

    await table_asr.transcribe_segment(uuid4())
    assert segment.status == "error"
    assert segment.error == "speechkit down"
