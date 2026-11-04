from uuid import uuid4

from app.scheme.session.scene import SceneCanvas, SceneInner, switch_scene_root
from app.services.map_polygons import polygon_name


def _scene() -> dict:
    return {
        "id": str(uuid4()),
        "name": "сцена",
        "location_id": str(uuid4()),
        "character_ids": [],
        "public": {"npc_ids": [], "item_ids": []},
        "private": {"npc_ids": [str(uuid4())], "item_ids": []},
    }


def test_old_scene_becomes_one_container():
    raw = _scene()
    scene = SceneInner.model_validate(raw)
    assert len(scene.containers) == 1
    assert scene.containers[0].location_id == scene.location_id
    assert scene.containers[0].private.npc_ids == scene.private.npc_ids


def test_switching_root_keeps_previous_lists():
    scene = SceneInner.model_validate(_scene())
    previous = scene.location_id
    previous_npc = scene.private.npc_ids[0]
    new_location = uuid4()
    switch_scene_root(scene, new_location)
    kept = next(bucket for bucket in scene.containers if bucket.location_id == previous)
    assert kept.private.npc_ids == [previous_npc]
    assert scene.location_id == new_location
    assert scene.private.npc_ids == []


def test_canvas_location_is_not_part_of_the_update_model():
    location_id = uuid4()
    canvas = SceneCanvas(id=uuid4(), location_id=location_id, name="зал")
    canvas.name = "другой"
    assert canvas.location_id == location_id


def test_centered_label_names_polygon_until_manual():
    shape = {"id": "abcd1234", "type": "rectangle", "x": 0, "y": 0, "width": 100, "height": 80}
    text = {"id": "t1", "type": "text", "x": 30, "y": 30, "width": 40, "height": 20, "text": "Таверна"}
    name, manual = polygon_name(None, shape, [shape, text])
    assert name == "Таверна"
    assert manual is False

    locked, is_manual = polygon_name(
        {"name": "Своё", "name_is_manual": True},
        shape,
        [shape, text],
    )
    assert locked == "Своё"
    assert is_manual is True
