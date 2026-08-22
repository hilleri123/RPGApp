from __future__ import annotations

from uuid import uuid4

from plugins.common.types import SceneContext, CharacterContext
from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from plugins.pbta.dungeon_world.base.backend.workflows.prepare_spells.workflow import (
    PrepareSpellsWorkflow,
    can_prepare_spells,
)


def test_can_prepare_spells():
    assert not can_prepare_spells({})
    assert not can_prepare_spells({"spellcasting": {"spells": []}})
    assert not can_prepare_spells({"spellcasting": {"spells": [{"title": "x"}]}})
    assert can_prepare_spells({"spellcasting": {"spells": [{"id": "s1", "title": "Fireball"}]}})


def test_actions_for_hidden_without_spells():
    wf = PrepareSpellsWorkflow(FullCodex())
    scene = SceneContext(
        id=uuid4(),
        name="s",
        data={},
        characters=[
            CharacterContext(id=uuid4(), name="Fighter", data={"level": 1}),
        ],
    )
    assert wf.actions_for(scene, "player") == []
    assert wf.actions_for(scene, "gm") == []

    scene.characters[0].data = {
        "spellcasting": {"spells": [{"id": "spell_1", "prepared": False, "level": 1}]},
    }
    keys = {a.key for a in wf.actions_for(scene, "player")}
    assert "prepare_spells" in keys
