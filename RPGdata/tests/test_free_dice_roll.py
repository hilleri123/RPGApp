from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from plugins.common.types import ActionContext, ActionParticipants, SceneContext, Workflow, Links
from plugins.common.workflows.free_dice_roll.workflow import FreeDiceRollWorkflow
from plugins.common.workflows.free_dice_roll.stages.declare import FreeDiceDeclareStage
from plugins.common.workflows.free_dice_roll.stages.roll import FreeDiceRollStage
from plugins.common.workflows.free_dice_roll.stages.result import FreeDiceResultStage
from plugins.common.protocols import ResultBuilder, StageCtx


class _DummyCodex:
    pass


@pytest.fixture
def wf_engine():
    return FreeDiceRollWorkflow(_DummyCodex())


def _scene() -> SceneContext:
    return SceneContext(
        id=uuid4(),
        name="Test scene",
        data={},
        characters=[],
    )


def _participants(user_id: UUID, gm_id: UUID | None = None) -> ActionParticipants:
    gm = gm_id or user_id
    return ActionParticipants(gmUserId=gm, participants=[user_id, gm])


def _action_ctx(
    *,
    user_id: UUID,
    scene: SceneContext,
    participants: ActionParticipants,
    workflow: Workflow | None = None,
    inp: dict | None = None,
) -> ActionContext:
    return ActionContext(
        scene=scene,
        players=[],
        links=Links(characterToUserId={}),
        actorUserId=user_id,
        participants=participants,
        actionKey="common.free_dice_roll",
        workflow=workflow,
        input=inp,
    )


def test_actions_for_player_and_gm(wf_engine):
    scene = _scene()
    keys = {a.key for a in wf_engine.actions_for(scene, "player")}
    assert "common.free_dice_roll" in keys
    keys_gm = {a.key for a in wf_engine.actions_for(scene, "gm")}
    assert "common.free_dice_roll" in keys_gm


def test_free_dice_roll_flow_deterministic(wf_engine):
    user_id = uuid4()
    gm_id = uuid4()
    scene = _scene()
    participants = _participants(user_id, gm_id=gm_id)

    start = wf_engine.start(_action_ctx(user_id=user_id, scene=scene, participants=participants))
    assert start.ok
    wf0 = start.workflow if isinstance(start.workflow, Workflow) else Workflow.model_validate(start.workflow)
    assert wf0.stageKey == FreeDiceDeclareStage.key
    assert start.participantIds == [str(user_id)]

    # GM must not edit declare/seed stages.
    gm_blocked = wf_engine.submit(
        _action_ctx(
            user_id=gm_id,
            scene=scene,
            participants=participants,
            workflow=wf0,
            inp={"declaration": "hack", "expression": "2d6"},
        )
    )
    assert not gm_blocked.ok

    after_declare = wf_engine.submit(
        _action_ctx(
            user_id=user_id,
            scene=scene,
            participants=participants,
            workflow=wf0,
            inp={"declaration": "Проверяю ловушку", "expression": "2d6"},
        )
    )
    assert after_declare.ok, after_declare.issues
    wf1 = after_declare.workflow if isinstance(after_declare.workflow, Workflow) else Workflow.model_validate(after_declare.workflow)
    assert wf1.stageKey == FreeDiceRollStage.key
    assert wf1.stageData["rollSpec"]["expression"] == "2d6"
    assert after_declare.participantIds == [str(user_id)]

    rolled = wf_engine.submit(
        _action_ctx(
            user_id=user_id,
            scene=scene,
            participants=participants,
            workflow=wf1,
            inp={"roll_seed": "test-seed-xyz"},
        )
    )
    assert rolled.ok, rolled.issues
    wf2 = rolled.workflow if isinstance(rolled.workflow, Workflow) else Workflow.model_validate(rolled.workflow)
    assert wf2.status == "active"
    assert wf2.stageKey == FreeDiceResultStage.key
    # Result stage is broadcast to the whole table.
    assert rolled.participantIds == []
    ctx = wf2.context
    assert ctx["roll"]["dice"]
    assert len(ctx["roll"]["dice"]) == 2
    assert ctx["roll"]["total"] == sum(ctx["roll"]["dice"])

    rolled2 = wf_engine.submit(
        _action_ctx(
            user_id=user_id,
            scene=scene,
            participants=participants,
            workflow=wf1,
            inp={"roll_seed": "test-seed-xyz"},
        )
    )
    wf2b = rolled2.workflow if isinstance(rolled2.workflow, Workflow) else Workflow.model_validate(rolled2.workflow)
    assert wf2b.context["roll"]["dice"] == ctx["roll"]["dice"]

    assert any(e.get("log_type") == "roll" for e in rolled.logEvents)
    roll_ev = next(e for e in rolled.logEvents if e.get("log_type") == "roll")
    assert roll_ev["roll_kind"] == "common.free_dice_roll"
    assert roll_ev["meta"]["declaration"] == "Проверяю ловушку"

    closed = wf_engine.submit(
        _action_ctx(
            user_id=user_id,
            scene=scene,
            participants=participants,
            workflow=wf2,
            inp={},
        )
    )
    assert closed.ok, closed.issues
    wf3 = closed.workflow if isinstance(closed.workflow, Workflow) else Workflow.model_validate(closed.workflow)
    assert wf3.status == "completed"
    assert wf3.stageKey == "completed"


def test_declare_rejects_bad_expression(wf_engine):
    user_id = uuid4()
    scene = _scene()
    participants = _participants(user_id)
    start = wf_engine.start(_action_ctx(user_id=user_id, scene=scene, participants=participants))
    wf = Workflow.model_validate(start.workflow)
    rb = ResultBuilder(lambda _p, _w: [], lambda _d: [])
    stage = FreeDiceDeclareStage(_DummyCodex())
    ctx = StageCtx(
        scene=scene,
        actor_user_id=user_id,
        participants=participants,
        participants_dict=participants.model_dump(mode="json"),
        rb=rb,
        links=Links(characterToUserId={}),
    )
    result = stage.submit(wf, ctx, {"expression": "2d6+1"})
    assert not result.ok
