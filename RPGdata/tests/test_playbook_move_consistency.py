import pytest

from plugins.pbta.base.backend.types import Move, Playbook
from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from plugins.pbta.dungeon_world.base.backend.codex.playbooks.validate_playbook_moves import (
    PlaybookMoveConsistencyError,
    validate_playbook_move_ids,
)


def test_dw_codex_playbooks_match_class_moves():
    FullCodex()


def test_validate_playbook_move_ids_extra_on_playbook():
    pb = Playbook(
        id="test",
        title="Test",
        starting_moves=["a"],
        advanced_moves=["ghost"],
    )
    moves = [
        Move(
            id="a",
            title="A",
            kind="class",
            available_stats=[],
            trigger="",
            effect="",
        ),
    ]
    with pytest.raises(PlaybookMoveConsistencyError, match="missing from Move codex"):
        validate_playbook_move_ids(pb, moves)


def test_validate_playbook_move_ids_missing_on_playbook():
    pb = Playbook(id="test", title="Test", starting_moves=["a"])
    moves = [
        Move(
            id="a",
            title="A",
            kind="class",
            available_stats=[],
            trigger="",
            effect="",
        ),
        Move(
            id="b",
            title="B",
            kind="advanced",
            available_stats=[],
            trigger="",
            effect="",
        ),
    ]
    with pytest.raises(PlaybookMoveConsistencyError, match="not on Playbook"):
        validate_playbook_move_ids(pb, moves)


def test_validate_playbook_move_ids_duplicate():
    pb = Playbook(
        id="test",
        title="Test",
        starting_moves=["a"],
        advanced_moves=["a"],
    )
    moves = [
        Move(
            id="a",
            title="A",
            kind="class",
            available_stats=[],
            trigger="",
            effect="",
        ),
    ]
    with pytest.raises(PlaybookMoveConsistencyError, match="duplicate"):
        validate_playbook_move_ids(pb, moves)
