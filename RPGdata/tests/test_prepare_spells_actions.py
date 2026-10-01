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
        data={"mode": "camp"},
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


def _scene(mode):
    from uuid import uuid4

    from plugins.common.types import CharacterContext, SceneContext

    ch = CharacterContext(
        id=uuid4(), name="Mage", data={"spellcasting": {"spells": [{"id": "s1", "title": "x"}]}}
    )
    return SceneContext(id=uuid4(), name="s", data={"mode": mode} if mode else {}, characters=[ch], npcs=[])


def test_prepare_spells_offered_only_in_camp():
    from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
    from plugins.pbta.dungeon_world.base.backend.workflows.prepare_spells.workflow import PrepareSpellsWorkflow

    wf = PrepareSpellsWorkflow(FullCodex())
    for role in ("player", "gm"):
        assert [a.key for a in wf.actions_for(_scene("camp"), role)] == ["prepare_spells"]
        assert [a.key for a in wf.actions_for(_scene("rest"), role)] == ["prepare_spells"]
        for mode in ("action", "travel", None):
            assert wf.actions_for(_scene(mode), role) == []


def test_prepare_spells_start_rejected_outside_camp():
    from uuid import uuid4

    from plugins.common.types import ActionContext, ActionParticipants, Links
    from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
    from plugins.pbta.dungeon_world.base.backend.workflows.prepare_spells.workflow import PrepareSpellsWorkflow

    gm, player = uuid4(), uuid4()
    for mode, ok in (("action", False), ("travel", False), ("camp", True)):
        scene = _scene(mode)
        links = Links(characterToUserId={scene.characters[0].id: player})
        res = PrepareSpellsWorkflow(FullCodex()).start(
            ActionContext(
                actionKey="prepare_spells",
                actorUserId=player,
                scene=scene,
                players=[],
                links=links,
                participants=ActionParticipants(gmUserId=gm, participants=[gm, player]),
            )
        )
        assert res.ok is ok, (mode, res.issues)
        if not ok:
            assert "только в лагере" in str(res.issues)
