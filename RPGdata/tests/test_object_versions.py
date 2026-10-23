"""Жест без картинки в документе и зона видимости как набор id."""

from types import SimpleNamespace
from uuid import uuid4

from app.services.gesture_materialize import apply_gesture_refs, collect_image_seeds
from app.services.session_object_store import normalize_scene_body
from app.services.visibility_service import wanted_ids


def test_collect_and_replace_image_seed():
    png = "data:image/png;base64,aaaa"
    node = {"workflow": {"roll_seed": png, "damage_seed": png, "total": 9}}
    found = collect_image_seeds(node)
    assert len(found) == 2
    assert found[0][0] == ("workflow", "roll_seed")

    replacements = {
        ("workflow", "roll_seed"): {
            "seed_hash": "abc",
            "gesture_id": "g1",
            "gesture_url": "/api/media/rolls/abc.png",
        },
        ("workflow", "damage_seed"): {
            "seed_hash": "def",
            "gesture_id": "g2",
            "gesture_url": "/api/media/rolls/def.png",
        },
    }
    out = apply_gesture_refs(node, replacements)
    assert out["workflow"]["roll_seed"] == "abc"
    assert out["workflow"]["gesture_id"] == "g1"
    assert out["workflow"]["damage_seed"] == "def"
    assert out["workflow"]["damage_seed_gesture_id"] == "g2"
    assert "base64" not in str(out)
    assert out["workflow"]["total"] == 9


def test_scene_obstacles_become_ids():
    obstacle_id = str(uuid4())
    body = normalize_scene_body({
        "id": str(uuid4()),
        "public": {"npc_ids": [], "obstacles": [{"id": obstacle_id, "name": "яма"}]},
        "private": {},
    })
    assert body["public"]["obstacle_ids"] == [obstacle_id]


def test_player_zone_is_own_scene_not_whole_scenario():
    me = uuid4()
    mine = uuid4()
    other = uuid4()
    absent = uuid4()
    scene_id = uuid4()
    npc_id = uuid4()
    hidden = uuid4()
    location_id = uuid4()
    user_id = uuid4()
    inner = SimpleNamespace(
        characters=[{"id": mine}, {"id": other}, {"id": absent}],
        npcs=[{"id": npc_id}, {"id": hidden}],
        items=[],
        scenes=[{
            "id": scene_id,
            "location_id": location_id,
            "character_ids": [mine, other],
            "public": {"npc_ids": [npc_id], "item_ids": [], "obstacles": []},
            "private": {"npc_ids": [hidden], "item_ids": [], "obstacles": []},
        }],
        actions=[{"id": uuid4(), "participantIds": [user_id]}],
        logs=[{"id": uuid4()}],
        audio_queue=[{"id": uuid4()}],
        locations=[{"id": location_id}],
        obstacles=[],
        notes=[{"id": uuid4(), "owner_user_id": user_id}, {"id": me, "owner_user_id": uuid4()}],
        story_beats=[],
    )
    zone = wanted_ids(inner, role="player", user_id=user_id, character_ids={mine})
    types = {object_type for object_type, _ in zone}
    ids = {oid for _, oid in zone}
    assert "scene" in types
    assert npc_id in ids
    assert location_id in ids
    assert other in ids
    assert hidden not in ids
    assert absent not in ids
    assert mine in ids
    assert me not in ids

    master = wanted_ids(inner, role="master", user_id=user_id, character_ids=set())
    master_ids = {oid for _, oid in master}
    assert hidden in master_ids
    assert other in master_ids
