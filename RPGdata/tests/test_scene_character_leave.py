"""Персонаж, уведённый в другую сцену, не остаётся в прежней через контейнер локации."""

from __future__ import annotations

import uuid

import app.main  # noqa: F401  (resolves circular imports)
from app import scheme


def _scene(location_id, character_ids):
    scene = scheme.SceneInner(
        id=uuid.uuid4(),
        name="s",
        data={},
        location_id=location_id,
        character_ids=list(character_ids),
        public=scheme.SceneElementsInner(npc_ids=[], item_ids=[]),
        private=scheme.SceneElementsInner(npc_ids=[], item_ids=[]),
    )
    scheme.sync_scene_projection(scene)
    return scene


def test_removed_character_does_not_come_back_from_the_bucket():
    char, other = uuid.uuid4(), uuid.uuid4()
    scene = _scene(uuid.uuid4(), [char, other])
    child = uuid.uuid4()
    scheme.switch_scene_root(scene, child)  # персонаж числится в контейнере прежней локации

    assert scheme.remove_scene_character(scene, char) is True
    scheme.sync_scene_projection(scene)  # то, что делает сохранение сцен

    assert char not in scene.character_ids
    assert other in scene.character_ids
    assert all(char not in bucket.character_ids for bucket in scene.containers)
    assert scheme.remove_scene_character(scene, char) is False
