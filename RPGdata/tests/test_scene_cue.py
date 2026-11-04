from app.scheme.session.base_actions import SessionActionBase


def test_scene_cue_parses():
    import app.scheme.session.player.scene  # noqa: F401

    action = SessionActionBase.parse_action({
        "user_role": "player",
        "msg_type": "scene_cue",
        "kind": "hand",
    })
    assert action.kind == "hand"
