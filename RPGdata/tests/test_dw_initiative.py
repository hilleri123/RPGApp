"""Инициатива Dungeon World: 2d6 + ЛОВ, порядок в SceneData, передача хода."""

from __future__ import annotations

from uuid import uuid4

import pytest

from plugins.common.types import (
    ActionContext,
    ActionParticipants,
    CharacterContext,
    Links,
    NPCContext,
    SceneContext,
    SubmitResult,
    Workflow,
)
from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from plugins.pbta.dungeon_world.base.backend.initiative import (
    advance_after_actor,
    dex_modifier,
    move_turn,
    set_turn,
)
from plugins.pbta.dungeon_world.base.backend.types.scene import SceneData
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import (
    PerformMoveContext,
    PerformMoveEntry,
)
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import (
    PerformMoveWorkflow,
)
from plugins.pbta.dungeon_world.base.backend.workflows.scene_battle_initiative_roll import (
    InitiativeTurnWorkflow,
    RollInitiativeWorkflow,
)

# --- SceneData ---------------------------------------------------------------


def test_scene_data_defaults_to_no_initiative():
    data = SceneData().model_dump()
    assert data["initiative"] == {"order": [], "values": {}, "active_index": 0, "round": 1}


def test_scene_data_normalizes_initiative():
    a, b = str(uuid4()), str(uuid4())
    data = SceneData.model_validate(
        {
            "mode": "action",
            "initiative": {
                "order": [a, b, a, ""],
                "values": {a: 11, b: 4, "gone": 9},
                "active_index": 7,
                "round": 0,
            },
        }
    ).model_dump()["initiative"]
    assert data["order"] == [a, b]
    assert data["values"] == {a: 11, b: 4}
    assert data["active_index"] == 0
    assert data["round"] == 1


def test_scene_data_survives_junk_initiative():
    assert SceneData.model_validate({"initiative": "oops"}).initiative.order == []


# --- модификатор ЛОВ ---------------------------------------------------------


def test_dex_modifier_sources():
    assert dex_modifier({"initiative_mod": 2, "stats": {"dex": 3}}) == 2
    assert dex_modifier({"stat_modifiers": {"dex": 1}, "stats": {"dex": 3}}) == 1
    assert dex_modifier({"stats": {"dex": 15}}) == 1
    assert dex_modifier({"stats": {"dex": 16}}) == 2
    assert dex_modifier({"stats": {"dex": 8}}) == -1
    assert dex_modifier({}) == 0
    assert dex_modifier(None) == 0


# --- переход хода ------------------------------------------------------------


def _scene_data(order, active=0, rnd=1):
    return {"initiative": {"order": order, "values": {}, "active_index": active, "round": rnd}}


def test_move_turn_advances_and_wraps_round():
    data = _scene_data(["a", "b", "c"], active=1)
    assert move_turn(data, {"a", "b", "c"})["active_index"] == 2

    wrapped = move_turn(_scene_data(["a", "b", "c"], active=2), {"a", "b", "c"})
    assert wrapped["active_index"] == 0
    assert wrapped["round"] == 2


def test_move_turn_skips_absent_and_goes_back():
    data = _scene_data(["a", "b", "c"], active=0)
    assert move_turn(data, {"a", "c"})["active_index"] == 2

    back = move_turn(_scene_data(["a", "b", "c"], active=0, rnd=3), {"a", "b", "c"}, step=-1)
    assert back["active_index"] == 2
    assert back["round"] == 2


def test_move_turn_nothing_to_move():
    assert move_turn(_scene_data([]), {"a"}) is None
    assert move_turn(_scene_data(["a", "b"]), set()) is None


def test_set_turn():
    assert set_turn(_scene_data(["a", "b"]), "b")["active_index"] == 1
    assert set_turn(_scene_data(["a", "b"]), "zzz") is None


def test_advance_after_actor_only_for_active_entity():
    data = _scene_data(["a", "b"], active=0)
    assert advance_after_actor(data, "a", {"a", "b"})["active_index"] == 1
    assert advance_after_actor(data, "b", {"a", "b"}) is None
    assert advance_after_actor(data, None, {"a", "b"}) is None
    assert advance_after_actor({}, "a", {"a"}) is None


# --- workflow ----------------------------------------------------------------


def _world(*, with_npc=True):
    gm, player = uuid4(), uuid4()
    hero, fast_hero, npc = uuid4(), uuid4(), uuid4()
    scene = SceneContext(
        id=uuid4(),
        name="fight",
        data={},
        characters=[
            CharacterContext(id=hero, name="Hero", data={"stats": {"dex": 9}}),
            CharacterContext(id=fast_hero, name="Fast", data={"stat_modifiers": {"dex": 3}}),
        ],
        npcs=[NPCContext(id=npc, name="Goblin", data={})] if with_npc else [],
    )
    participants = ActionParticipants(gmUserId=gm, participants=[gm, player])
    links = Links(characterToUserId={hero: player})
    return gm, player, scene, participants, links, (hero, fast_hero, npc)


def _ctx(scene, participants, links, actor, *, wf=None, input=None):
    return ActionContext(
        actionKey="roll_initiative",
        actorUserId=actor,
        scene=scene,
        players=[],
        links=links,
        participants=participants,
        workflow=wf,
        input=input,
    )


@pytest.fixture(autouse=True)
def _no_seed_files(monkeypatch):
    """Не пишем рисунки жестов на диск в тестах."""
    from app.services.roll_persist import seed_hash_of
    from plugins.pbta.dungeon_world.base.backend.workflows.scene_battle_initiative_roll import logic

    monkeypatch.setattr(
        logic, "store_seed_image", lambda seed: (seed_hash_of(seed), f"rolls/{seed_hash_of(seed)}.png")
    )


def _gesture(tag="a"):
    """Похоже на рисунок жеста из CanvasSeed: data-URL PNG."""
    return "data:image/png;base64," + (tag * 80)


def _start_roll(w=None):
    """Стадия бросков: никто ещё не бросал."""
    w = w or RollInitiativeWorkflow(FullCodex())
    gm, player, scene, participants, links, ids = _world()
    res = w.start(_ctx(scene, participants, links, gm))
    assert res.ok, res.issues
    return w, gm, player, scene, participants, links, ids, Workflow.model_validate(res.workflow)


def _submit(w, scene, participants, links, actor, wf, **input):
    res = w.submit(_ctx(scene, participants, links, actor, wf=wf, input=input or None))
    return res, Workflow.model_validate(res.workflow)


def _start(w=None):
    """Состояние стадии мастера: игрок бросил сам, мастер — за NPC."""
    w, gm, player, scene, participants, links, ids, wf = _start_roll(w)
    res, wf = _submit(w, scene, participants, links, player, wf, op="roll", roll_seed=_gesture())
    assert res.ok, res.issues
    res, wf = _submit(w, scene, participants, links, gm, wf, op="roll_npcs", roll_seed=_gesture())
    assert res.ok, res.issues
    assert wf.stageKey == "initiative.review"
    return w, gm, player, scene, participants, links, ids, wf


def test_start_waits_for_rolls_nobody_rolled_yet():
    _, gm, player, _, _, _, ids, wf = _start_roll()
    assert wf.stageKey == "initiative.roll"
    entries = wf.context["entries"]
    assert {e["entity_id"] for e in entries} == {str(x) for x in ids}
    assert all(e["rolled"] is False and e["dice"] == [] for e in entries)


def test_roll_stage_visible_to_gm_and_owning_players_only():
    w, gm, player, scene, participants, links, ids, _ = _start_roll()
    res = w.start(_ctx(scene, participants, links, gm))
    assert {str(x) for x in res.participantIds} == {str(gm), str(player)}


def test_player_rolls_only_own_character():
    w, gm, player, scene, participants, links, ids, wf = _start_roll()
    hero, fast, npc = (str(x) for x in ids)

    res, wf = _submit(w, scene, participants, links, player, wf, op="roll", roll_seed=_gesture())
    assert res.ok, res.issues
    by_id = {e["entity_id"]: e for e in wf.context["entries"]}
    assert by_id[hero]["rolled"] is True and len(by_id[hero]["dice"]) == 2
    assert by_id[hero]["total"] == sum(by_id[hero]["dice"]) + by_id[hero]["modifier"]
    assert by_id[fast]["rolled"] is False and by_id[npc]["rolled"] is False
    assert wf.stageKey == "initiative.roll"

    # второй раз бросать нечего, чужим персонажем не бросишь
    again, _ = _submit(w, scene, participants, links, player, wf, op="roll", roll_seed=_gesture())
    assert not again.ok
    stranger, _ = _submit(w, scene, participants, links, uuid4(), wf, op="roll", roll_seed=_gesture())
    assert not stranger.ok


def test_gm_rolls_all_npcs_from_one_seed():
    w, gm, player, scene, participants, links, ids, wf = _start_roll()
    hero, fast, npc = (str(x) for x in ids)

    res, wf = _submit(w, scene, participants, links, gm, wf, op="roll_npcs", roll_seed=_gesture())
    assert res.ok, res.issues
    by_id = {e["entity_id"]: e for e in wf.context["entries"]}
    # NPC и персонаж без игрока — от одного seed, игрока мастер за него не бросает
    assert by_id[npc]["rolled"] and by_id[fast]["rolled"] and not by_id[hero]["rolled"]
    seed = _gesture()
    from app.services.roll_persist import seed_hash_of
    from plugins.common.dice import roll_2d6

    # в контексте только хэш жеста, а кубы выводятся из самого жеста
    assert wf.context["npc_seed"] == seed_hash_of(seed)
    assert by_id[npc]["roll_seed"] == by_id[fast]["roll_seed"] == seed_hash_of(seed)
    assert by_id[npc]["seed_image_ref"] == f"rolls/{seed_hash_of(seed)}.png"
    assert by_id[npc]["dice"] == list(roll_2d6(f"{seed}:{npc}")[0])
    assert by_id[fast]["dice"] == list(roll_2d6(f"{seed}:{fast}")[0])

    # повторный бросок за NPC невозможен
    again, _ = _submit(w, scene, participants, links, gm, wf, op="roll_npcs", roll_seed=_gesture())
    assert not again.ok
    # игрок не может бросать за NPC
    bad, _ = _submit(w, scene, participants, links, player, wf, op="roll_npcs", roll_seed=_gesture())
    assert not bad.ok


def test_every_roll_requires_gesture_seed():
    w, gm, player, scene, participants, links, ids, wf = _start_roll()
    for actor, op in ((player, "roll"), (gm, "roll_npcs"), (gm, "proceed")):
        for bad in ({}, {"roll_seed": ""}, {"roll_seed": "short"}):
            res, _ = _submit(w, scene, participants, links, actor, wf, op=op, **bad)
            assert not res.ok, (op, bad)
            assert "жест" in str(res.issues[0]).lower()


def test_same_gesture_gives_same_dice_for_same_entity():
    w, gm, player, scene, participants, links, ids, wf = _start_roll()
    a, wf_a = _submit(w, scene, participants, links, player, wf, op="roll", roll_seed=_gesture("x"))
    b, wf_b = _submit(w, scene, participants, links, player, wf, op="roll", roll_seed=_gesture("x"))
    c, wf_c = _submit(w, scene, participants, links, player, wf, op="roll", roll_seed=_gesture("y"))
    hero = str(ids[0])
    dice = lambda w_: next(e for e in w_.context["entries"] if e["entity_id"] == hero)["dice"]
    assert dice(wf_a) == dice(wf_b)
    assert isinstance(dice(wf_c), list) and len(dice(wf_c)) == 2


def test_review_starts_automatically_when_everyone_rolled():
    _, _, _, _, _, _, _, wf = _start()
    assert wf.stageKey == "initiative.review"
    totals = [e["total"] for e in wf.context["entries"]]
    assert totals == sorted(totals, reverse=True)
    assert all(e["rolled"] for e in wf.context["entries"])
    assert wf.stageData["candidates"] == []


def test_gm_can_proceed_without_waiting_for_player():
    w, gm, player, scene, participants, links, ids, wf = _start_roll()
    res, wf = _submit(w, scene, participants, links, gm, wf, op="proceed", roll_seed=_gesture("g"))
    assert res.ok, res.issues
    assert wf.stageKey == "initiative.review"
    assert all(e["rolled"] for e in wf.context["entries"])
    assert {str(x) for x in res.participantIds} == {str(gm)}

    w2, gm2, player2, scene2, participants2, links2, _, wf2 = _start_roll()
    denied, _ = _submit(w2, scene2, participants2, links2, player2, wf2, op="proceed", roll_seed=_gesture("g"))
    assert not denied.ok


def test_order_cannot_be_edited_during_rolls():
    w, gm, _, scene, participants, links, ids, wf = _start_roll()
    res = w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"order": [str(ids[0])]}))
    assert not res.ok


def test_only_gm_can_start_and_edit():
    w = RollInitiativeWorkflow(FullCodex())
    gm, player, scene, participants, links, _ = _world()
    assert not w.start(_ctx(scene, participants, links, player)).ok

    w, gm, player, scene, participants, links, ids, wf = _start(w)
    hero = str(ids[0])
    bad = w.patch(_ctx(scene, participants, links, player, wf=wf, input={"reroll": [hero], "roll_seed": _gesture("r")}))
    assert not bad.ok
    assert not w.submit(_ctx(scene, participants, links, player, wf=wf)).ok


def test_gm_reorders_and_manual_order_sticks():
    w, gm, _, scene, participants, links, ids, wf = _start()
    hero, fast, npc = (str(x) for x in ids)

    res = w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"order": [npc, hero, fast]}))
    assert res.ok, res.issues
    wf = Workflow.model_validate(res.workflow)
    assert [e["entity_id"] for e in wf.context["entries"]] == [npc, hero, fast]

    # значение правится вручную, порядок остаётся ручным
    res = w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"values": {fast: 99}}))
    wf = Workflow.model_validate(res.workflow)
    assert [e["entity_id"] for e in wf.context["entries"]] == [npc, hero, fast]
    assert next(e for e in wf.context["entries"] if e["entity_id"] == fast)["manual"] is True


def test_gm_can_remove_and_add_back():
    w, gm, _, scene, participants, links, ids, wf = _start()
    hero, fast, npc = (str(x) for x in ids)

    res = w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"remove": [npc]}))
    wf = Workflow.model_validate(res.workflow)
    assert npc not in [e["entity_id"] for e in wf.context["entries"]]
    assert [c["id"] for c in wf.stageData["candidates"]] == [npc]

    res = w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"add": [npc], "roll_seed": _gesture("r")}))
    wf = Workflow.model_validate(res.workflow)
    assert npc in [e["entity_id"] for e in wf.context["entries"]]
    assert wf.stageData["candidates"] == []


def test_add_and_reroll_require_gesture_seed():
    w, gm, _, scene, participants, links, ids, wf = _start()
    hero, fast, npc = (str(x) for x in ids)
    wf = Workflow.model_validate(
        w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"remove": [npc]})).workflow
    )
    for edit in ({"add": [npc]}, {"reroll": [hero]}):
        res = w.patch(_ctx(scene, participants, links, gm, wf=wf, input=edit))
        assert not res.ok
    ok = w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"reroll": [hero], "roll_seed": _gesture("q")}))
    assert ok.ok, ok.issues


def test_add_rejects_entity_outside_scene():
    w, gm, _, scene, participants, links, _, wf = _start()
    res = w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"add": [str(uuid4())], "roll_seed": _gesture("r")}))
    assert not res.ok


def test_submit_writes_order_to_scene_and_completes():
    w, gm, _, scene, participants, links, ids, wf = _start()
    hero, fast, npc = (str(x) for x in ids)
    wf = Workflow.model_validate(
        w.patch(_ctx(scene, participants, links, gm, wf=wf, input={"order": [fast, npc, hero]})).workflow
    )

    res = w.submit(_ctx(scene, participants, links, gm, wf=wf))
    assert res.ok, res.issues
    assert res.workflow.status == "completed"

    patch = res.sessionPatch["scenes"][0]
    assert patch["id"] == str(scene.id)
    ini = patch["dataPatch"]["initiative"]
    assert ini["order"] == [fast, npc, hero]
    assert ini["active_index"] == 0 and ini["round"] == 1
    assert set(ini["values"]) == {hero, fast, npc}

    # то, что уйдёт в сцену, проходит валидацию SceneData без потерь
    assert SceneData.model_validate({"initiative": ini}).initiative.order == [fast, npc, hero]


def test_actions_listed_for_gm_only_and_turn_needs_initiative():
    roll = RollInitiativeWorkflow(FullCodex())
    turn = InitiativeTurnWorkflow(FullCodex())
    _, _, scene, _, _, _ = _world()

    assert [a.key for a in roll.actions_for(scene, "gm")] == ["roll_initiative"]
    assert roll.actions_for(scene, "player") == []
    assert turn.actions_for(scene, "gm") == []

    scene.data = _scene_data(["a"])
    assert [a.key for a in turn.actions_for(scene, "gm")] == ["initiative_turn"]


def test_turn_workflow_next_set_end():
    turn = InitiativeTurnWorkflow(FullCodex())
    gm, _, scene, participants, links, ids = _world()
    a, b, c = (str(x) for x in ids)
    scene.data = _scene_data([a, b, c], active=2, rnd=1)

    def run(op, **extra):
        started = turn.start(_ctx(scene, participants, links, gm))
        assert started.ok, started.issues
        wf = Workflow.model_validate(started.workflow)
        return turn.submit(_ctx(scene, participants, links, gm, wf=wf, input={"op": op, **extra}))

    nxt = run("next")
    ini = nxt.sessionPatch["scenes"][0]["dataPatch"]["initiative"]
    assert ini["active_index"] == 0 and ini["round"] == 2

    picked = run("set", entity_id=b)
    assert picked.sessionPatch["scenes"][0]["dataPatch"]["initiative"]["active_index"] == 1

    ended = run("end")
    assert ended.sessionPatch["scenes"][0]["dataPatch"]["initiative"]["order"] == []

    assert not run("bogus").ok


def test_turn_workflow_rejects_non_gm():
    turn = InitiativeTurnWorkflow(FullCodex())
    gm, player, scene, participants, links, ids = _world()
    scene.data = _scene_data([str(ids[0])])
    assert not turn.start(_ctx(scene, participants, links, player)).ok


# --- perform_move передаёт ход ----------------------------------------------


def _finished_move(actor_id, kind="character", status="completed", source_npc_id=None):
    ctx = PerformMoveContext(
        scene_id=uuid4(),
        entry=PerformMoveEntry(
            actor_user_id=uuid4(),
            actor_kind=kind,
            actor_character_id=actor_id if kind == "character" else None,
            actor_npc_id=actor_id if kind == "npc" else None,
            source_npc_id=str(source_npc_id) if source_npc_id else None,
        ),
    )
    wf = Workflow(
        actionKey="perform_move",
        stageKey="completed",
        status=status,
        context=ctx.model_dump(mode="json"),
    )
    return SubmitResult(ok=True, workflow=wf.model_dump(mode="json"))


def _move_action(scene):
    gm = uuid4()
    return ActionContext(
        actionKey="perform_move",
        actorUserId=gm,
        scene=scene,
        players=[],
        links=Links(characterToUserId={}),
        participants=ActionParticipants(gmUserId=gm, participants=[gm]),
    )


def test_completed_move_of_active_actor_advances_turn():
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    hero, fast, npc = ids
    scene.data = _scene_data([str(hero), str(fast), str(npc)], active=0)

    result = move._advance_initiative(_move_action(scene), _finished_move(hero))
    ini = result.sessionPatch["scenes"][0]["dataPatch"]["initiative"]
    assert ini["active_index"] == 1


def test_npc_actor_advances_turn_too():
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    hero, fast, npc = ids
    scene.data = _scene_data([str(npc), str(hero)], active=0)

    result = move._advance_initiative(_move_action(scene), _finished_move(npc, kind="npc"))
    assert result.sessionPatch["scenes"][0]["dataPatch"]["initiative"]["active_index"] == 1


def test_npc_source_move_advances_when_npc_is_active():
    """Ход NPC: бросает персонаж, а NPC — источник хода; очередь идёт дальше."""
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    hero, fast, npc = ids
    scene.data = _scene_data([str(npc), str(hero)], active=0)

    result = move._advance_initiative(_move_action(scene), _finished_move(hero, source_npc_id=npc))
    assert result.sessionPatch["scenes"][0]["dataPatch"]["initiative"]["active_index"] == 1


def test_npc_source_move_of_other_npc_does_not_advance():
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    hero, fast, npc = ids
    scene.data = _scene_data([str(fast), str(hero), str(npc)], active=0)

    # ходит `fast`, а ход провоцирует другой NPC и реагирует другой персонаж — очередь на месте
    result = move._advance_initiative(_move_action(scene), _finished_move(hero, source_npc_id=npc))
    assert result.sessionPatch is None


def test_out_of_turn_move_does_not_advance():
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    hero, fast, npc = ids
    scene.data = _scene_data([str(hero), str(fast)], active=0)

    result = move._advance_initiative(_move_action(scene), _finished_move(fast))
    assert result.sessionPatch is None


def test_unfinished_move_does_not_advance():
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    hero = ids[0]
    scene.data = _scene_data([str(hero), str(ids[1])], active=0)

    result = move._advance_initiative(_move_action(scene), _finished_move(hero, status="active"))
    assert result.sessionPatch is None


def test_scene_without_initiative_is_untouched():
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    result = move._advance_initiative(_move_action(scene), _finished_move(ids[0]))
    assert result.sessionPatch is None


def test_dw_factory_registers_initiative_workflows():
    from plugins.pbta.dungeon_world.base.backend.workflows import workflows

    keys = {WF(FullCodex()).key for WF in workflows}
    assert {"roll_initiative", "initiative_turn", "perform_move"} <= keys


def test_session_patch_lands_in_scene_data():
    """Патч workflow реально попадает в data сцены через менеджер действий."""
    import importlib

    importlib.import_module("app.main")
    from app.managers.session.action_manager import _patch_list_by_id
    from app.scheme.session.scene import SceneInner

    hero = str(uuid4())
    scene = SceneInner.model_validate(
        {
            "id": str(uuid4()),
            "name": "s",
            "data": {"mode": "action"},
            "location_id": str(uuid4()),
            "character_ids": [],
            "public": {},
            "private": {},
        }
    )
    ini = {"order": [hero], "values": {hero: 9}, "active_index": 0, "round": 1}

    updated, changed = _patch_list_by_id(
        [scene], [{"id": str(scene.id), "dataPatch": {"initiative": ini}}]
    )
    assert changed
    assert updated[0].data["mode"] == "action"
    assert updated[0].data["initiative"]["order"] == [hero]

    # второй патч (передача хода) сливается, а не затирает соседние ключи
    step = {**ini, "active_index": 0, "round": 2}
    updated, _ = _patch_list_by_id(updated, [{"id": str(scene.id), "dataPatch": {"initiative": step}}])
    assert updated[0].data["initiative"]["round"] == 2
    assert updated[0].data["initiative"]["values"] == {hero: 9}


# --- лагерь и путешествие без инициативы -------------------------------------


@pytest.mark.parametrize("mode", ["camp", "travel", "rest"])
def test_no_initiative_in_camp_and_travel(mode):
    gm, player, scene, participants, links, ids = _world()
    scene.data = {"mode": mode, "initiative": {"order": [str(ids[0]), str(ids[1])], "values": {}, "active_index": 0, "round": 1}}

    roll = RollInitiativeWorkflow(FullCodex())
    turn = InitiativeTurnWorkflow(FullCodex())
    assert roll.actions_for(scene, "gm") == []
    assert turn.actions_for(scene, "gm") == []

    started = roll.start(_ctx(scene, participants, links, gm))
    assert not started.ok
    assert "инициатива не ведётся" in str(started.issues).lower()
    assert not turn.start(_ctx(scene, participants, links, gm)).ok


def test_initiative_works_in_action_scene_and_by_default():
    gm, player, scene, participants, links, ids = _world()
    for data in ({}, {"mode": "action"}, {"mode": "combat"}):
        scene.data = data
        assert [a.key for a in RollInitiativeWorkflow(FullCodex()).actions_for(scene, "gm")] == ["roll_initiative"]
        assert RollInitiativeWorkflow(FullCodex()).start(_ctx(scene, participants, links, gm)).ok


def test_finished_move_does_not_advance_turn_in_camp():
    move = PerformMoveWorkflow(FullCodex())
    _, _, scene, _, _, ids = _world()
    hero, fast, npc = ids
    scene.data = {**_scene_data([str(hero), str(fast)], active=0), "mode": "camp"}

    result = move._advance_initiative(_move_action(scene), _finished_move(hero))
    assert result.sessionPatch is None

    scene.data = {**scene.data, "mode": "action"}
    result = move._advance_initiative(_move_action(scene), _finished_move(hero))
    assert result.sessionPatch["scenes"][0]["dataPatch"]["initiative"]["active_index"] == 1
