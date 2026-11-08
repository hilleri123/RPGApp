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


def test_appetite_complication_opens_the_same_field_on_full_hit():
    gm, _, _, _, scene, participants, links, wf = _world("hit_10_plus")
    ctx = PerformMoveContext.model_validate(wf.context)
    ctx.entry.roll.appetite_complication = True
    ctx.entry.roll.dice = [6, 3]
    ctx.entry.roll.dice_sides = [6, 8]
    wf.context = ctx.model_dump(mode="json")
    w = PerformMoveWorkflow(FullCodex())
    wf = _wf(w.patch(_ctx(scene, participants, links, gm, wf, gm_complication="К6 выше: стража услышала")))
    res = w.submit(_ctx(scene, participants, links, gm, wf, action="apply", mode="review", lines=[]))
    assert res.ok, res.issues
    entry = _entry(_wf(res))
    directives = [e for e in entry.resolve.effects if e.kind == "gm_directive"]
    assert [e.payload["text"] for e in directives] == ["К6 выше: стража услышала"]
    assert "Косяк (к6 выше к8): К6 выше: стража услышала" in entry.resolve.log_lines


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


def test_related_player_is_a_recipient_as_soon_as_the_line_appears():
    gm, actor, hero, goblin, scene, _, _, wf = _world()
    other, victim = uuid4(), uuid4()
    scene.characters.append(CharacterContext(id=victim, name="Victim", data={}))
    participants = ActionParticipants(gmUserId=gm, participants=[gm], initiatorUserId=actor)
    links = Links(characterToUserId={hero: actor, victim: other})
    line = {
        "id": "l1",
        "kind": "damage",
        "target": {"kind": "character", "id": str(victim), "name": "Victim"},
        "payload": {"hp_effect": "damage", "damage_expr": "d6", "source_kind": "npc", "source_id": str(goblin)},
        "status": "needs_roll",
        "label": "",
    }
    w = PerformMoveWorkflow(FullCodex())
    res = w.patch(_ctx(scene, participants, links, gm, wf, lines=[line]))
    assert res.ok, res.issues
    assert str(other) in {str(item) for item in res.participantIds}
    saved = _wf(res)
    assert _manifest(saved)["lines"][0]["payload"]["roller_user_id"] == str(other)
    rolled = w.patch(_ctx(
        scene, participants, links, other, saved,
        commit_roll={"id": "l1", "roll_seed": "recipient-seed"},
    ))
    assert rolled.ok, rolled.issues


def test_player_declares_a_pending_line_on_any_target():
    _, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    res = w.patch(_ctx(scene, participants, links, player, wf, lines=[_line(goblin, hero)]))
    assert res.ok, res.issues
    line = _manifest(_wf(res))["lines"][0]
    assert line["status"] == "pending"
    assert line["target"]["kind"] == "npc"
    assert not w.submit(_ctx(scene, participants, links, player, wf, action="apply", mode="edit", lines=[_line(goblin, hero)])).ok


def test_gm_line_is_approved_and_the_player_rolls_it_here():
    gm, player, hero, goblin, scene, participants, links, wf = _world()
    w = PerformMoveWorkflow(FullCodex())
    sent = _wf(w.patch(_ctx(scene, participants, links, gm, wf, lines=[_line(goblin, hero)])))
    assert _manifest(sent)["lines"][0]["status"] == "needs_roll"
    assert sent.stageData["wizard"]["currentKey"] == MANIFEST
    assert not w.submit(_ctx(scene, participants, links, gm, sent, action="apply", mode="edit")).ok
    rolled = w.patch(_ctx(
        scene, participants, links, player, sent,
        commit_roll={"id": "l1", "roll_seed": "player-seed"},
    ))
    assert rolled.ok, rolled.issues
    done = _wf(rolled)
    assert done.stageData["wizard"]["currentKey"] == MANIFEST
    claim = _entry(done).damage_claims[0]
    assert claim.rolled and claim.dice
    assert str(claim.roller_user_id) == str(player)
    assert _manifest(done)["lines"][0]["status"] == "rolled"


def test_issue_changes_starts_on_the_manifest():
    from plugins.pbta.dungeon_world.base.backend.workflows.issue_changes import IssueChangesWorkflow

    gm, player, hero, goblin, scene, participants, links, _wf_unused = _world()
    participants = ActionParticipants(gmUserId=gm, participants=[gm, player], initiatorUserId=gm)
    res = IssueChangesWorkflow(FullCodex()).start(ActionContext(
        actionKey="issue_changes",
        actorUserId=gm,
        scene=scene,
        players=[],
        links=links,
        participants=participants,
        workflow=None,
        input={},
    ))
    assert res.ok, res.issues
    started = _wf(res)
    assert started.actionKey == "issue_changes"
    assert started.stageKey == "perform_move.post_roll"
    assert started.stageData["wizard"]["currentKey"] == MANIFEST
    denied = IssueChangesWorkflow(FullCodex()).start(ActionContext(
        actionKey="issue_changes",
        actorUserId=player,
        scene=scene,
        players=[],
        links=links,
        participants=participants,
        workflow=None,
        input={},
    ))
    assert not denied.ok


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


def test_player_cannot_submit_setup():
    gm, player = uuid4(), uuid4()
    hero = uuid4()
    scene = SceneContext(
        id=uuid4(),
        name="fight",
        data={},
        characters=[CharacterContext(id=hero, name="Hero", data={})],
        npcs=[],
    )
    participants = ActionParticipants(gmUserId=gm, participants=[gm, player], initiatorUserId=gm)
    links = Links(characterToUserId={hero: player})
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.setup",
        status="active",
        context=PerformMoveContext(
            scene_id=scene.id,
            entry=PerformMoveEntry(actor_user_id=gm),
        ).model_dump(mode="json"),
        stageData={},
    )
    res = PerformMoveWorkflow(FullCodex()).submit(ActionContext(
        actionKey="perform_move",
        actorUserId=player,
        scene=scene,
        players=[],
        links=links,
        participants=participants,
        workflow=wf,
        input={"_stageKey": "perform_move.setup", "actor_character_id": str(hero)},
    ))
    assert not res.ok
    assert _wf(res).stageKey == "perform_move.setup"


def test_unrelated_viewer_does_not_see_damage_dice():
    from app.services.damage_roll_visibility import redact_damage_rolls

    gm, player, other = uuid4(), uuid4(), uuid4()
    hero, bystander = uuid4(), uuid4()
    action = {
        "actionKey": "perform_move",
        "participants": {"gmUserId": str(gm)},
        "scene": {"links": {"characterToUserId": {str(hero): str(player), str(bystander): str(other)}}},
        "workflow": {
            "context": {"entry": {"damage_claims": [{
                "id": "c1",
                "source_kind": "character",
                "source_character_id": str(hero),
                "target_kind": "npc",
                "target_npc_id": "goblin",
                "dice": [4],
                "total_raw": 4,
                "total_final": 4,
                "roll_seed": "seed",
            }]}},
            "stageData": {"stages": {"perform_move.change_manifest": {"lines": [{
                "id": "c1",
                "kind": "damage",
                "target": {"kind": "npc", "id": "goblin"},
                "payload": {
                    "source_kind": "character",
                    "source_id": str(hero),
                    "damage_expr": "d6",
                    "dice": [4],
                    "total_final": 4,
                    "roll_seed": "seed",
                },
            }]}}},
        },
    }
    redact_damage_rolls(action, str(other))
    assert action["workflow"]["context"]["entry"]["damage_claims"] == []
    assert action["workflow"]["stageData"]["stages"]["perform_move.change_manifest"]["lines"] == []
    action["workflow"]["context"]["entry"]["damage_claims"] = [{
        "id": "c1", "rolled": True, "source_kind": "character", "source_character_id": str(hero),
        "target_kind": "npc", "dice": [4], "roll_seed": "seed",
    }]
    action["workflow"]["stageData"]["stages"]["perform_move.change_manifest"]["lines"] = [{
        "id": "c1", "kind": "damage", "status": "rolled",
        "target": {"kind": "npc", "id": "goblin"},
        "payload": {"source_kind": "character", "source_id": str(hero), "dice": [4], "rolled": True},
    }]
    redact_damage_rolls(action, str(other))
    assert action["workflow"]["context"]["entry"]["damage_claims"][0]["dice"] == [4]
    assert action["workflow"]["stageData"]["stages"]["perform_move.change_manifest"]["lines"][0]["payload"]["dice"] == [4]

    visible = {
        "actionKey": "perform_move",
        "participants": {"gmUserId": str(gm)},
        "scene": {"links": {"characterToUserId": {str(hero): str(player)}}},
        "workflow": {"context": {"entry": {"damage_claims": [{
            "id": "c1", "source_kind": "character", "source_character_id": str(hero),
            "target_kind": "npc", "dice": [6], "roll_seed": "s",
        }]}}},
    }
    redact_damage_rolls(visible, str(player))
    assert visible["workflow"]["context"]["entry"]["damage_claims"][0]["dice"] == [6]
    redact_damage_rolls(visible, str(gm))
    assert visible["workflow"]["context"]["entry"]["damage_claims"][0]["dice"] == [6]


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


def test_weapon_choice_brings_bonus_and_piercing():
    from plugins.common.types.context import ItemContext
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import (
        damage_quick_options,
    )

    hero = uuid4()
    sword = ItemContext(
        id=uuid4(),
        name="Меч",
        data={
            "weapon": {
                "damage_dice": "d10",
                "damage_bonus": {"bonus": 1},
                "piercing": {"value": 2},
                "mechanic_tags": ["ignores-armor"],
            }
        },
    )
    scene = SceneContext(
        id=uuid4(),
        name="s",
        data={},
        characters=[CharacterContext(id=hero, name="Герой", data={"damage_die": "d8"}, items=[sword])],
        npcs=[],
    )
    weapon = next(o for o in damage_quick_options(scene) if o["kind"] == "character_weapon")
    assert weapon["damage_expr"] == "d10+1"
    assert weapon["piercing"] == 2
    assert weapon["ignores_armor"] is True
    assert weapon["weapon_name"] == "Меч"
