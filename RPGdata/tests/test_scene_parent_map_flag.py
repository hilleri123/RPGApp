from uuid import uuid4

from app.scheme.session.scene import SceneInner


def _scene(extra: dict | None = None) -> dict:
    return {
        "id": str(uuid4()),
        "name": "подсцена",
        "location_id": str(uuid4()),
        "character_ids": [],
        "parent_scene_id": str(uuid4()),
        "public": {"npc_ids": [], "item_ids": []},
        "private": {"npc_ids": [], "item_ids": []},
        **(extra or {}),
    }


def test_old_scene_defaults_parent_map_flag_off():
    scene = SceneInner.model_validate(_scene())
    assert scene.show_parent_scene_map is False


def test_parent_map_flag_roundtrip():
    scene = SceneInner.model_validate(_scene({"show_parent_scene_map": True}))
    assert scene.show_parent_scene_map is True
    again = SceneInner.model_validate(scene.model_dump(mode="json"))
    assert again.show_parent_scene_map is True


def test_set_show_parent_scene_map_action_parses():
    import app.scheme.session.master.scene  # noqa: F401
    from app.scheme.session.base_actions import SessionActionBase

    action = SessionActionBase.parse_action({
        "user_role": "master",
        "msg_type": "set_show_parent_scene_map",
        "scene_id": str(uuid4()),
        "value": True,
    })
    assert action.value is True
