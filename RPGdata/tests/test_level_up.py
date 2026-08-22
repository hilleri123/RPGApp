from __future__ import annotations

from uuid import uuid4

import pytest

from plugins.common.types import ActionContext, ActionParticipants, Links, SceneContext, CharacterContext, Workflow
from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from plugins.pbta.dungeon_world.base.backend.workflows.level_up.helpers import (
    apply_level_up,
    can_level_up,
    xp_cost_for_level,
)
from plugins.pbta.dungeon_world.base.backend.workflows.level_up.workflow import LevelUpWorkflow
from plugins.pbta.dungeon_world.base.backend.workflows.level_up.stages.choose import LevelUpChooseStage
from plugins.pbta.dungeon_world.base.backend.workflows.level_up.stages.review import LevelUpReviewStage


@pytest.fixture
def codex():
    return FullCodex()


@pytest.fixture
def wf(codex):
    return LevelUpWorkflow(codex)


def _fighter_scene(codex, *, xp=8, moves=None):
    user_id = uuid4()
    gm_id = uuid4()
    char_id = uuid4()
    pb = codex.playbooks.playbooks_map()["fighter"]
    scene = SceneContext(
        id=uuid4(),
        name="s",
        data={},
        characters=[
            CharacterContext(
                id=char_id,
                name="Fighter",
                data={
                    "playbook_id": "fighter",
                    "level": 1,
                    "xp": xp,
                    "stats": {"str": 16, "dex": 15, "con": 13, "int": 12, "wis": 9, "cha": 8},
                    "moves": moves if moves is not None else list(pb.starting_moves),
                    "hp": 13,
                    "max_hp": 13,
                    "custom_moves": [],
                },
            )
        ],
    )
    participants = ActionParticipants(gmUserId=gm_id, participants=[user_id, gm_id])
    links = Links(characterToUserId={char_id: user_id})
    return user_id, gm_id, char_id, scene, participants, links, pb


def test_xp_cost():
    assert xp_cost_for_level(1) == 8
    assert xp_cost_for_level(5) == 12


def test_can_level_up():
    assert can_level_up({"level": 1, "xp": 8})
    assert not can_level_up({"level": 1, "xp": 7})


def test_apply_level_up_fighter(codex):
    pb = codex.playbooks.playbooks_map()["fighter"]
    move_id = next(m for m in pb.advanced_moves)
    data = {
        "playbook_id": "fighter",
        "level": 1,
        "xp": 10,
        "stats": {"str": 16, "dex": 15, "con": 13, "int": 12, "wis": 9, "cha": 8},
        "moves": list(pb.starting_moves),
        "hp": 13,
        "max_hp": 13,
    }
    updated = apply_level_up(codex, data, stat_id="str", move_id=move_id)
    assert updated["level"] == 2
    assert updated["xp"] == 2
    assert updated["stats"]["str"] == 17
    assert move_id in updated["moves"]
    assert updated["stat_modifiers"]["str"] == 2


def test_actions_for_only_when_ready(wf):
    scene = SceneContext(
        id=uuid4(),
        name="s",
        data={},
        characters=[
            CharacterContext(
                id=uuid4(),
                name="A",
                data={"level": 1, "xp": 3},
            )
        ],
    )
    assert wf.actions_for(scene, "player") == []

    scene.characters[0].data = {"level": 1, "xp": 8}
    keys = {a.key for a in wf.actions_for(scene, "player")}
    assert "level_up" in keys


def test_choose_visible_only_to_player(wf, codex):
    user_id, gm_id, char_id, scene, participants, links, _ = _fighter_scene(codex)
    start = wf.start(ActionContext(
        scene=scene, players=[], links=links, actorUserId=user_id,
        participants=participants, actionKey="level_up", workflow=None, input={},
    ))
    assert start.ok
    assert set(start.participantIds or []) == {str(user_id)}
    assert str(gm_id) not in (start.participantIds or [])


def test_start_builds_workflow_even_without_moves(wf, codex):
    pb = FullCodex().playbooks.playbooks_map()["fighter"]
    owned = list(pb.starting_moves) + list(pb.advanced_moves)
    user_id, gm_id, char_id, scene, participants, links, _ = _fighter_scene(codex, moves=owned)

    start = wf.start(ActionContext(
        scene=scene, players=[], links=links, actorUserId=user_id,
        participants=participants, actionKey="level_up", workflow=None, input={},
    ))
    assert start.ok
    wf0 = start.workflow if isinstance(start.workflow, Workflow) else Workflow.model_validate(start.workflow)
    assert wf0.status == "active"
    assert wf0.stageData["moves"] == []
    assert wf0.stageData["characterId"] == str(char_id)
    assert any("advanced" in b.lower() or "ходов" in b for b in wf0.stageData["blockers"])


def test_player_then_gm_flow(wf, codex):
    user_id, gm_id, char_id, scene, participants, links, pb = _fighter_scene(codex)
    move_id = next(m for m in pb.advanced_moves)

    start = wf.start(ActionContext(
        scene=scene, players=[], links=links, actorUserId=user_id,
        participants=participants, actionKey="level_up", workflow=None, input={},
    ))
    assert start.ok
    wf0 = start.workflow if isinstance(start.workflow, Workflow) else Workflow.model_validate(start.workflow)
    assert wf0.stageKey == LevelUpChooseStage.key
    assert any(m["id"] == move_id for m in wf0.stageData["moves"])
    chosen = next(m for m in wf0.stageData["moves"] if m["id"] == move_id)
    assert chosen.get("trigger") or chosen.get("effect") or chosen.get("effect_10_plus")
    assert chosen.get("tier_badge") == "ур. 2+"
    assert "skills" in wf0.stageData

    drafted = wf.submit(ActionContext(
        scene=scene, players=[], links=links, actorUserId=user_id,
        participants=participants, actionKey="level_up", workflow=wf0,
        input={"stat_id": "dex", "move_id": move_id},
    ))
    assert drafted.ok
    assert drafted.sessionPatch is None
    wf1 = drafted.workflow if isinstance(drafted.workflow, Workflow) else Workflow.model_validate(drafted.workflow)
    assert wf1.stageKey == LevelUpReviewStage.key
    assert set(drafted.participantIds or []) == {str(user_id), str(gm_id)}

    done = wf.submit(ActionContext(
        scene=scene, players=[], links=links, actorUserId=gm_id,
        participants=participants, actionKey="level_up", workflow=wf1,
        input={"decision": "approve", "stat_id": "dex", "move_id": move_id},
    ))
    assert done.ok
    assert done.sessionPatch is not None
    patch = done.sessionPatch["characters"][0]["dataPatch"]
    assert patch["level"] == 2
    assert patch["xp"] == 0
    assert patch["stats"]["dex"] == 16
    assert move_id in patch["moves"]


def test_gm_can_grant_custom_move_on_review(wf, codex):
    pb = codex.playbooks.playbooks_map()["fighter"]
    user_id, gm_id, char_id, scene, participants, links, _ = _fighter_scene(
        codex, moves=list(pb.starting_moves) + list(pb.advanced_moves),
    )

    start = wf.start(ActionContext(
        scene=scene, players=[], links=links, actorUserId=gm_id,
        participants=participants, actionKey="level_up", workflow=None,
        input={"character_id": str(char_id)},
    ))
    assert start.ok
    wf0 = start.workflow if isinstance(start.workflow, Workflow) else Workflow.model_validate(start.workflow)
    assert wf0.stageKey == LevelUpReviewStage.key
    assert set(start.participantIds or []) == {str(user_id), str(gm_id)}

    custom = {
        "id": "custom_test_1",
        "title": "Секретный приём",
        "trigger": "Когда бьёшь",
        "effect": "Наносишь +1d4",
        "available_stats": ["str"],
    }
    done = wf.submit(ActionContext(
        scene=scene, players=[], links=links, actorUserId=gm_id,
        participants=participants, actionKey="level_up", workflow=wf0,
        input={"decision": "approve", "stat_id": "str", "move_id": custom["id"], "custom_move": custom},
    ))
    assert done.ok
    patch = done.sessionPatch["characters"][0]["dataPatch"]
    assert patch["level"] == 2
    assert "custom_test_1" in patch["moves"]
    assert any(c["id"] == "custom_test_1" for c in patch["custom_moves"])
