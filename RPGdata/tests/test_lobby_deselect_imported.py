"""Regression: session star-import must not shadow lobby WS action types."""

from app.scheme import MasterDeselectPlayerCharacter as SchemeDeselect
from app.scheme.lobby import ActionBase, MasterDeselectPlayerCharacter as LobbyDeselect


def test_lobby_master_deselect_not_shadowed_by_session():
    assert LobbyDeselect is not SchemeDeselect
    action = ActionBase.parse_action(
        {
            "user_role": "master",
            "msg_type": "master_deselect_character",
            "player_id": "236a73c2-c282-4c22-a9b2-3fb2f44e9ae0",
        }
    )
    assert isinstance(action, LobbyDeselect)
    assert not isinstance(action, SchemeDeselect)
