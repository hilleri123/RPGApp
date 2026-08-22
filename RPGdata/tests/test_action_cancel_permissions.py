"""Tests for action cancel lock heuristics and cancel permissions."""

from __future__ import annotations

from uuid import uuid4

from app.services.action_cancel_policy import (
    action_progress_locks_initiator,
    user_may_cancel_action,
)
from app.scheme.session.plugin_actions import ActionRecord
from plugins.common.types import ActionParticipants


def _action(**kwargs) -> ActionRecord:
    initiator = kwargs.pop("initiator", uuid4())
    defaults = dict(
        id=uuid4(),
        actionKey="perform_move",
        status="active",
        scene_id=uuid4(),
        participants=ActionParticipants(
            gmUserId=uuid4(),
            initiatorUserId=initiator,
            participants=[],
            placeholders={},
        ),
        participantIds=[],
        workflow={},
        sessionPatch=None,
    )
    defaults.update(kwargs)
    return ActionRecord(**defaults)


def test_lock_false_for_fresh_action():
    assert action_progress_locks_initiator(_action()) is False


def test_lock_false_for_default_empty_roll_state():
    """perform_move starts with RollState dice=[] / total=0 — initiator must still cancel."""
    a = _action(
        workflow={
            "context": {
                "entry": {
                    "roll": {"dice": [], "total": 0, "outcome": None, "roll_seed": "", "result_text": ""},
                }
            }
        }
    )
    assert action_progress_locks_initiator(a) is False


def test_lock_on_completed_status():
    assert action_progress_locks_initiator(_action(status="completed")) is True


def test_lock_on_session_patch():
    assert action_progress_locks_initiator(_action(sessionPatch={"npcs": [{"id": "x"}]})) is True


def test_lock_on_roll_dice():
    a = _action(
        workflow={
            "context": {
                "entry": {
                    "roll": {"dice": [4, 5], "total": 9, "outcome": "partial"},
                }
            }
        }
    )
    assert action_progress_locks_initiator(a) is True


def test_lock_on_damage_claim_rolled():
    a = _action(
        workflow={
            "context": {
                "entry": {
                    "damage_claims": [{"id": "d1", "rolled": True}],
                }
            }
        }
    )
    assert action_progress_locks_initiator(a) is True


def test_lock_on_stage_data_dice():
    a = _action(
        workflow={
            "stageData": {
                "perform_move.roll": {"roll_seed": "seed", "dice": [3, 4]},
            }
        }
    )
    assert action_progress_locks_initiator(a) is True


def test_no_lock_on_post_roll_without_dice():
    """roll.required=False can enter post_roll without a committed roll."""
    a = _action(workflow={"stageKey": "perform_move.post_roll", "context": {"entry": {"roll": {}}}})
    assert action_progress_locks_initiator(a) is False


def test_user_may_cancel_denied_for_non_initiator():
    master_id = uuid4()
    initiator_id = uuid4()
    other_id = uuid4()
    action = _action(initiator=initiator_id)
    assert user_may_cancel_action(user_id=other_id, master_id=master_id, action=action) is False


def test_user_may_cancel_allowed_for_initiator_before_roll():
    master_id = uuid4()
    initiator_id = uuid4()
    action = _action(initiator=initiator_id)
    assert user_may_cancel_action(user_id=initiator_id, master_id=master_id, action=action) is True


def test_user_may_cancel_denied_for_initiator_after_roll():
    master_id = uuid4()
    initiator_id = uuid4()
    action = _action(
        initiator=initiator_id,
        workflow={"context": {"entry": {"roll": {"dice": [2, 6], "total": 8}}}},
    )
    assert user_may_cancel_action(user_id=initiator_id, master_id=master_id, action=action) is False


def test_user_may_cancel_allowed_for_master_after_apply():
    master_id = uuid4()
    initiator_id = uuid4()
    action = _action(
        initiator=initiator_id,
        sessionPatch={"npcs": [{"id": "n1"}]},
    )
    assert user_may_cancel_action(user_id=master_id, master_id=master_id, action=action) is True
