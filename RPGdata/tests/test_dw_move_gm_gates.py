"""perform_move: косяк мастера на 7–9 и подтверждение заявки/итога мастером."""

from __future__ import annotations

from uuid import uuid4

from plugins.common.types import (
    ActionContext,
    ActionParticipants,
    CharacterContext,
    Links,
    NPCContext,
    SceneContext,
    Workflow,
)
from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import (
    PerformMoveContext,
    PerformMoveEntry,
)
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow

MANIFEST = "perform_move.change_manifest"


def _world(outcome="hit_7_9"):
    gm, player = uuid4(), uuid4()
    hero, goblin = uuid4(), uuid4()
    scene = SceneContext(
        id=uuid4(),
        name="fight",
        data={},
        characters=[CharacterContext(id=hero, name="Hero", data={})],
        npcs=[NPCContext(id=goblin, name="Goblin", data={})],
    )
    participants = ActionParticipants(gmUserId=gm, participants=[gm, player], initiatorUserId=player)
    links = Links(characterToUserId={hero: player})
    ctx = PerformMoveContext(
        scene_id=scene.id,
        entry=PerformMoveEntry(
            actor_user_id=player,
            actor_kind="character",
            actor_character_id=hero,
            roll={"required": True, "outcome": outcome, "dice": [3, 4], "total": 7, "roll_seed": "x" * 70},
        ),
    )
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.post_roll",
        status="active",
        context=ctx.model_dump(mode="json"),
        stageData={"wizard": {"currentKey": MANIFEST, "furthestKey": MANIFEST}},
    )
    return gm, player, hero, goblin, scene, participants, links, wf


def _ctx(scene, participants, links, actor, wf, **inp):
    return ActionContext(
        actionKey="perform_move",
        actorUserId=actor,
        scene=scene,
        players=[],
        links=links,
        participants=participants,
        workflow=wf,
        input={"_stageKey": MANIFEST, **inp},
    )


def _line(goblin, hero=None):
    return {
        "id": "l1",
        "kind": "damage",
        "target": {"kind": "npc", "id": str(goblin), "name": "Goblin"},
        "payload": {
            "hp_effect": "damage",
            "damage_expr": "d6",
            "source_kind": "character",
            "source_id": str(hero or uuid4()),
        },
        "status": "needs_roll",
        "label": "",
    }


def _wf(res):
    return Workflow.model_validate(res.workflow)


def _manifest(wf):
    return wf.stageData["stages"][MANIFEST]


def _entry(wf):
    return PerformMoveContext.model_validate(wf.context).entry


# --- косяк ---------------------------------------------------------------


def test_gm_writes_complication_on_partial_hit():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    res = w.patch(_ctx(scene, participants, links, gm, wf, gm_complication="  Меч   застрял в двери "))
    assert res.ok, res.issues
    assert _entry(_wf(res)).gm_complication == "Меч застрял в двери"


def test_player_cannot_write_complication():
    _, player, _, _, scene, participants, links, wf = _world()
    res = PerformMoveWorkflow(FullCodex()).patch(_ctx(scene, participants, links, player, wf, gm_complication="я сам"))
    assert not res.ok


def test_complication_only_on_seven_to_nine():
    for outcome in ("hit_10_plus", "miss_6_minus"):
        gm, _, _, _, scene, participants, links, wf = _world(outcome)
        res = PerformMoveWorkflow(FullCodex()).patch(_ctx(scene, participants, links, gm, wf, gm_complication="косяк"))
        assert not res.ok, outcome


def test_complication_lands_in_result_effects_and_log_on_apply():
    gm, _, _, _, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    wf = _wf(w.patch(_ctx(scene, participants, links, gm, wf, gm_complication="Шум привлёк стражу")))
    res = w.submit(_ctx(scene, participants, links, gm, wf, action="apply", mode="review", lines=[]))
    assert res.ok, res.issues
    done = _wf(res)
    assert done.status == "completed"
    entry = _entry(done)
    directives = [e for e in entry.resolve.effects if e.kind == "gm_directive"]
    assert [e.payload["text"] for e in directives] == ["Шум привлёк стражу"]
    assert "Косяк (7–9): Шум привлёк стражу" in entry.resolve.log_lines


def test_stale_complication_is_ignored_if_outcome_changed():
    gm, _, _, _, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    wf = _wf(w.patch(_ctx(scene, participants, links, gm, wf, gm_complication="косяк")))
    ctx = PerformMoveContext.model_validate(wf.context)
    ctx.entry.roll.outcome = "hit_10_plus"
    wf.context = ctx.model_dump(mode="json")
    res = w.submit(_ctx(scene, participants, links, gm, wf, action="apply", mode="review", lines=[]))
    assert res.ok, res.issues
    assert not [e for e in _entry(_wf(res)).resolve.effects if e.kind == "gm_directive"]


# --- подтверждение мастером -------------------------------------------------


def test_player_continue_sends_claim_to_gm_and_stays():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    res = w.submit(_ctx(scene, participants, links, player, wf, action="continue", mode="edit", lines=[_line(goblin, hero)]))
    assert res.ok, res.issues
    sent = _wf(res)
    assert sent.status == "active"
    assert sent.stageKey == "perform_move.post_roll"
    assert sent.stageData["wizard"]["currentKey"] == MANIFEST
    assert _manifest(sent)["sent_to_gm"] is True
    assert _manifest(sent)["mode"] == "edit"
    assert [ln["id"] for ln in _manifest(sent)["lines"]] == ["l1"]
    # заявки на урон ещё не созданы: мастер не подтвердил
    assert _entry(sent).damage_claims == []


def test_player_edit_after_sending_resets_the_flag():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    sent = _wf(w.submit(_ctx(scene, participants, links, player, wf, action="continue", mode="edit", lines=[_line(goblin, hero)])))
    res = w.patch(_ctx(scene, participants, links, player, sent, lines=[_line(goblin, hero), {**_line(goblin, hero), "id": "l2"}]))
    assert res.ok, res.issues
    assert _manifest(_wf(res))["sent_to_gm"] is False


def test_gm_confirms_claim_and_moves_to_damage_rolls():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    sent = _wf(w.submit(_ctx(scene, participants, links, player, wf, action="continue", mode="edit", lines=[_line(goblin, hero)])))
    res = w.submit(_ctx(scene, participants, links, gm, sent, action="continue", mode="edit"))
    assert res.ok, res.issues
    nxt = _wf(res)
    assert nxt.stageData["wizard"]["currentKey"] == "perform_move.damage_roll"
    assert [c.target_npc_id for c in _entry(nxt).damage_claims] == [str(goblin)]
    assert _manifest(nxt)["sent_to_gm"] is False


def test_gm_own_claim_needs_no_second_confirmation():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    res = w.submit(_ctx(scene, participants, links, gm, wf, action="continue", mode="edit", lines=[_line(goblin, hero)]))
    assert res.ok, res.issues
    assert _wf(res).stageData["wizard"]["currentKey"] == "perform_move.damage_roll"


def test_player_cannot_accept_final_review():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    wf.stageData = {**wf.stageData, "stages": {MANIFEST: {"mode": "review", "lines": []}}}
    for inp in ({"action": "apply", "mode": "review"}, {"action": "continue", "mode": "review"}, {}):
        res = w.submit(_ctx(scene, participants, links, player, wf, **inp))
        assert not res.ok, inp
    assert _wf(res).status == "active"


def test_player_cannot_edit_lines_during_review():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    wf.stageData = {**wf.stageData, "stages": {MANIFEST: {"mode": "review", "lines": [_line(goblin, hero)]}}}
    res = w.patch(_ctx(scene, participants, links, player, wf, lines=[]))
    assert not res.ok
    assert w.patch(_ctx(scene, participants, links, gm, wf, lines=[])).ok


def test_gm_accepts_final_review():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    wf.stageData = {**wf.stageData, "stages": {MANIFEST: {"mode": "review", "lines": []}}}
    res = w.submit(_ctx(scene, participants, links, gm, wf, action="apply", mode="review"))
    assert res.ok, res.issues
    assert _wf(res).status == "completed"


# --- куб урона персонажа ----------------------------------------------------


def test_damage_quick_option_uses_playbook_die():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import (
        character_damage_die,
        damage_quick_options,
    )

    codex = FullCodex()
    playbook_id, playbook = next(iter(codex.playbooks.playbooks_map().items()))
    die = playbook.damage_die

    assert character_damage_die({"playbook_id": playbook_id}, codex) == die
    assert character_damage_die({"playbook_id": playbook_id, "damage_die": "d12"}, codex) == "d12"
    assert character_damage_die({}, codex) == "d6"

    hero = uuid4()
    scene = SceneContext(
        id=uuid4(),
        name="s",
        data={},
        characters=[CharacterContext(id=hero, name="Hero", data={"playbook_id": playbook_id})],
        npcs=[],
    )
    opts = damage_quick_options(scene, codex)
    assert [o["damage_expr"] for o in opts if o["kind"] == "character"] == [die]
