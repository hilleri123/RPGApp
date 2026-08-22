from __future__ import annotations

from uuid import uuid4

from app.services.action_events import (
    broadcast_to_log,
    extract_workflow_log_lines,
    log_event_draft_to_model,
)
from app.services.roll_service import RollSpec, roll_from_seed, roll_2d6


def test_roll_2d6_is_deterministic():
    dice_a, sum_a = roll_2d6("seed-1")
    dice_b, sum_b = roll_2d6("seed-1")
    assert dice_a == dice_b
    assert sum_a == sum_b
    assert len(dice_a) == 2


def test_roll_from_seed_with_modifiers():
    spec = RollSpec(
        expression="2d6",
        modifiers=[
            {"id": "stat", "label": "STR", "value": 2},
            {"id": "aid", "label": "Aid", "value": 1},
        ],
    )
    result = roll_from_seed("canvas-seed", spec)
    assert len(result.dice) == 2
    assert result.modifier_total == 3
    assert result.total == result.rolled_sum + 3


def test_broadcast_to_log_dice_roll():
    user_id = uuid4()
    log = broadcast_to_log(
        user_id,
        {
            "type": "dice.roll",
            "rolls": [4, 6],
            "best": 6,
            "character_name": "Vance",
            "action": "skirmish",
            "outcome": "success",
            "roll_seed": "abc",
        },
        action_key="blades.roll",
    )
    assert log is not None
    assert log.dice == [4, 6]
    assert log.total == 6
    assert log.title == "Vance · skirmish"


def test_log_event_draft_to_model_roll():
    user_id = uuid4()
    log = log_event_draft_to_model(
        user_id,
        {
            "log_type": "roll",
            "title": "Hack and Slash",
            "dice": [4, 5],
            "total": 12,
            "outcome": "hit_10_plus",
        },
    )
    assert log is not None
    assert log.log_type == "roll"
    assert log.total == 12


def test_extract_workflow_log_lines():
    wf = {
        "context": {
            "entry": {
                "log_lines": ["line one", "", "line two"],
            }
        }
    }
    assert extract_workflow_log_lines(wf) == ["line one", "line two"]
