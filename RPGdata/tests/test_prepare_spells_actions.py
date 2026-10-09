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


def test_prepare_start_marks_focus_and_free():
    from uuid import uuid4

    from plugins.common.types import ActionContext, ActionParticipants, CharacterContext, Links, SceneContext
    from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import spell_prepared_level_cost
    from plugins.pbta.dungeon_world.base.backend.workflows.prepare_spells.workflow import PrepareSpellsWorkflow

    gm, player = uuid4(), uuid4()
    ch = CharacterContext(
        id=uuid4(),
        name="Mage",
        data={
            "playbook_id": "wizard",
            "level": 1,
            "spellcasting": {
                "spells": [
                    {"id": "focus1", "spell_id": "light", "title": "Свет", "level": 0, "prepared": False},
                    {"id": "free1", "title": "Дар", "level": 3, "prepared": False, "free": True, "source": "custom"},
                    {"id": "norm1", "title": "Огонь", "level": 1, "prepared": True, "school": "воплощение", "source": "custom"},
                    {"id": "marked", "title": "Метка", "level": 2, "prepared": False, "school": "фокус", "source": "custom"},
                ],
            },
        },
    )
    scene = SceneContext(id=uuid4(), name="camp", data={"mode": "camp"}, characters=[ch], npcs=[])
    res = PrepareSpellsWorkflow(FullCodex()).start(
        ActionContext(
            actionKey="prepare_spells",
            actorUserId=player,
            scene=scene,
            players=[],
            links=Links(characterToUserId={ch.id: player}),
            participants=ActionParticipants(gmUserId=gm, participants=[gm, player]),
        )
    )
    assert res.ok, res.issues
    draft = {item["id"]: item for item in res.workflow.context["entry"]["prepared_draft"]}
    assert draft["focus1"]["is_cantrip"] is True
    assert draft["focus1"]["prepared"] is True
    assert draft["focus1"]["school"] == "фокус"
    assert draft["free1"]["free"] is True
    assert draft["free1"]["prepared"] is True
    assert draft["marked"]["is_cantrip"] is True
    assert draft["marked"]["prepared"] is True
    assert draft["norm1"]["prepared"] is True
    assert spell_prepared_level_cost(draft["free1"]) == 0
    assert spell_prepared_level_cost(draft["focus1"]) == 0
    assert spell_prepared_level_cost(draft["marked"]) == 0
    assert spell_prepared_level_cost(draft["norm1"]) == 1
