from types import SimpleNamespace
from uuid import uuid4

from app.services.chronicle import (
    KIND_DW_XP,
    KIND_NOTE,
    has_list_filter,
    render_chronicle_text,
    stamp_from_inner,
)


def test_list_requires_a_filter():
    assert has_list_filter() is False
    assert has_list_filter(subject_id=uuid4()) is True
    assert has_list_filter(kinds=["plugin:dw:xp"]) is True
    assert has_list_filter(scene_id=uuid4()) is True


def test_xp_line_uses_stamp_and_amount():
    character_id = uuid4()
    text = render_chronicle_text(
        kind=KIND_DW_XP,
        text=f"[//character:{character_id}] выполнил уговор",
        subject_id=character_id,
        payload={"amount": 1},
        stamp={"game_time": "2000-01-20T11:30:00", "location_id": "loc-1"},
    )
    assert text == f"2000-01-20 11:30 · [//location:loc-1] · +1 опыт · [//character:{character_id}] выполнил уговор"


def test_note_line_is_a_normal_note_link():
    note_id = uuid4()
    text = render_chronicle_text(
        kind=KIND_NOTE,
        text="Игроки заставили выплатить долг",
        subject_id=note_id,
        payload={},
        stamp={
            "game_time": "2000-01-20T11:30:00",
            "scene_time": "2000-01-20T11:30:00",
            "location_id": "room",
        },
    )
    assert f"[//note:{note_id}]" in text
    assert "сцена 2000-01-20 11:30" in text
    assert "[//location:room]" in text


def test_stamp_reads_scene_clock_and_session_clock():
    scene_id = uuid4()
    location_id = uuid4()
    inner = SimpleNamespace(
        timeline=SimpleNamespace(current_time=None),
        scenario_starts_at=None,
        scenes=[
            SimpleNamespace(id=scene_id, datetime="2000-01-20T11:30:00", location_id=location_id),
        ],
    )
    stamp = stamp_from_inner(inner, scene_id)
    assert stamp["scene_time"] == "2000-01-20T11:30:00"
    assert stamp["location_id"] == location_id
    assert stamp["scene_id"] == scene_id
