from __future__ import annotations

from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.engine import (
    expand_dw_choice_effects,
    resolve_dw_move_outcome,
)
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import (
    attacks_to_damage_claims,
    consume_bonuses_patch,
    list_consumable_bonuses,
    move_is_available,
)


class _Scene:
    def __init__(self):
        self.characters = [type("Ch", (), {"id": "c1", "name": "Hero"})()]
        self.npcs = [type("Npc", (), {"id": "n1", "name": "Goblin"})()]


def test_list_consumable_bonuses_only_forward_ongoing():
    data = {
        "state": {
            "resources": [
                {"id": "gf1", "spec_id": "guidance_forward", "amount": 3, "description": "legacy"},
                {"id": "f1", "spec_id": "forward", "amount": 1},
                {"id": "o1", "spec_id": "ongoing", "amount": 2},
            ],
            "temp_bonuses": [
                {"id": "t1", "spec_id": "forward", "amount": 1},
            ],
        },
    }
    bonuses = list_consumable_bonuses(data, stat_id="str", move_ids=["hack-and-slash"])
    spec_ids = {b["spec_id"] for b in bonuses}
    assert spec_ids == {"forward", "ongoing"}
    assert sum(b["amount"] for b in bonuses if b["spec_id"] == "forward") == 2


def test_wizard_lists_pre_roll_substeps():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.stage_store import PRE_ROLL_SUBSTEPS
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.pre_roll",
        status="active",
        context={"scene_id": str(uuid4()), "entry": {"actor_user_id": str(uid), "roll": {}, "moves": []}},
        stageData={"wizard": {"furthestKey": "perform_move.declare", "currentKey": "perform_move.declare"}},
    )
    c = PerformMoveContext.model_validate(wf.context)
    PerformMoveWorkflow()._attach_wizard(wf, c)
    steps = wf.stageData["wizard"]["steps"]
    assert len(steps) == len(PRE_ROLL_SUBSTEPS)
    assert steps[0]["key"] == "perform_move.declare"
    assert steps[0]["status"] == "current"
    assert wf.stageData["wizard"]["phase"] == "perform_move.pre_roll"


def test_wizard_roll_phase_not_disabled_when_furthest_stale():
    """Entering roll must not mark the current roll step as pending/disabled."""
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(uid),
                "roll": {"required": True, "dice": [], "stat_id": "str"},
                "moves": [{"id": "hack", "title": "Hack", "kind": "basic"}],
            },
        },
        # Stale wizard left over from last pre_roll substep
        stageData={
            "wizard": {
                "furthestKey": "perform_move.aid",
                "currentKey": "perform_move.aid",
            }
        },
    )
    c = PerformMoveContext.model_validate(wf.context)
    PerformMoveWorkflow()._attach_wizard(wf, c)
    wiz = wf.stageData["wizard"]
    assert wiz["currentKey"] == "perform_move.roll"
    assert wiz["furthestKey"] == "perform_move.roll"
    roll_step = next(s for s in wiz["steps"] if s["key"] == "perform_move.roll")
    assert roll_step["disabled"] is False
    assert roll_step["editable"] is True
    assert roll_step["status"] == "current"


def test_invalidate_subsequent_clears_roll():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.stage_store import (
        invalidate_subsequent,
        set_stage_data,
    )
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.pre_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(uid),
                "roll": {"dice": [], "stat_id": "str"},
                "moves": [],
                "effects": [],
                "pending_choices": [],
            },
        },
        stageData={},
    )
    set_stage_data(wf, "perform_move.declare", {"move_ids": ["hack-and-slash"], "stat_id": "str"})
    set_stage_data(wf, "perform_move.bonuses", {"consume_bonus_ids": ["b1"]})
    cleared = invalidate_subsequent(wf, "perform_move.declare")
    assert "perform_move.bonuses" in cleared
    c = PerformMoveContext.model_validate(wf.context)
    assert c.entry.resolve.effects == []
    assert c.entry.resolve.pending_choices == []
    assert wf.stageKey == "perform_move.pre_roll"


def test_consume_forward_bonus():
    data = {
        "state": {
            "temp_bonuses": [
                {"id": "b1", "spec_id": "forward", "amount": 1},
                {"id": "b2", "spec_id": "ongoing", "amount": 1},
            ],
        },
    }
    out = consume_bonuses_patch(data, ["b1", "b2"], only_consume_on="roll")
    bonuses = out["state"]["temp_bonuses"]
    assert len(bonuses) == 1
    assert bonuses[0]["spec_id"] == "ongoing"


def test_attacks_to_damage_claims_half_damage():
    scene = _Scene()
    claims = attacks_to_damage_claims(
        [{
            "source_kind": "character",
            "source_id": "c1",
            "target_kind": "npc",
            "target_id": "n1",
            "damage_expr": "d10",
            "half_damage": True,
        }],
        scene=scene,
        source_move_id="go_aggro",
    )
    assert len(claims) == 1
    assert claims[0].half_damage is True
    assert claims[0].multiplier == 0.5
    assert claims[0].formula == "d10"


def test_resolve_go_aggro_7_9_choice():
    codex = FullCodex()
    move = codex.moves.moves_map()["go_aggro"]
    effects, choices, logs = resolve_dw_move_outcome(move, "hit_7_9")
    assert choices
    assert choices[0].choose == 1
    assert len(choices[0].options) == 3


def test_expand_dw_choice_effects_logs():
    codex = FullCodex()
    move = codex.moves.moves_map()["go_aggro"]
    _, choices, _ = resolve_dw_move_outcome(move, "hit_7_9")
    effects, logs = expand_dw_choice_effects(
        move=move,
        pending=choices[0],
        chosen_ids=[choices[0].options[0].id],
        target_kind="npc",
        target_character_id=None,
        target_npc_id="n1",
    )
    assert logs
    assert isinstance(effects, list)


def test_move_requires_context():
    codex = FullCodex()
    move = codex.moves.moves_map()["shoot_at"]
    assert move_is_available(
        move, actor_resources={}, context_tags={"action"}, active_move_ids={move.id},
    )
    assert not move_is_available(
        move, actor_resources={}, context_tags={"travel"}, active_move_ids={move.id},
    )
    from plugins.pbta.base.backend.types import MoveCondition

    blocked = move.model_copy(update={
        "condition": MoveCondition(requires_context=["ranged"]),
    })
    assert not move_is_available(
        blocked,
        actor_resources={},
        context_tags={"melee"},
        active_move_ids={blocked.id},
    )


def test_apply_resource_draft_merges_existing_resources():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.engine import apply_resource_draft
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import ResourceDraft

    class _Scene:
        characters = [
            type("Ch", (), {
                "id": "c1",
                "data": {
                    "hp": 10,
                    "state": {
                        "resources": [
                            {"id": "h1", "spec_id": "hold", "amount": 1, "source_move_id": "defend"},
                        ],
                    },
                },
            })(),
        ]
        npcs = []

    ctx = type("Ctx", (), {"scene": _Scene()})()
    draft = ResourceDraft(
        id="r1",
        move_id="defend",
        spec_id="hold",
        amount=2,
        target_kind="character",
        target_id="c1",
        confirmed=True,
    )
    patch = apply_resource_draft(ctx, draft, {})
    assert "characters" in patch
    resources = patch["characters"][0]["dataPatch"]["state"]["resources"]
    hold = next(r for r in resources if r["spec_id"] == "hold")
    assert hold["amount"] == 3


def test_should_offer_damage_claim_for_any_move():
    from uuid import uuid4
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import should_offer_damage_claim
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext, PerformMoveEntry
    from plugins.pbta.base.backend.workflows.perform_move.types import MoveRef

    c = PerformMoveContext(
        scene_id=uuid4(),
        entry=PerformMoveEntry(
            actor_user_id=uuid4(),
            moves=[MoveRef(id="bard_arcane_art", title="Тайное искусство", kind="class")],
        ),
    )
    assert should_offer_damage_claim(c, {}) is True


def test_attacks_world_source_and_heal():
    scene = _Scene()
    claims = attacks_to_damage_claims(
        [{
            "source_kind": "world",
            "source_label": "Потолок",
            "target_kind": "npc",
            "target_id": "n1",
            "damage_expr": "d8",
            "hp_effect": "damage",
        }],
        scene=scene,
        source_move_id="act_under_fire",
    )
    assert len(claims) == 1
    assert claims[0].source_kind == "world"
    assert claims[0].source_label == "Потолок"

    heal = attacks_to_damage_claims(
        [{
            "source_kind": "character",
            "source_id": "c1",
            "target_kind": "character",
            "target_id": "c1",
            "damage_expr": "1d8",
            "hp_effect": "heal",
        }],
        scene=scene,
    )
    assert heal[0].hp_effect == "heal"


def test_apply_heal_patch():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.engine import build_damage_hp_patches
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import DamageClaim

    class _Scene:
        characters = [
            type("Ch", (), {
                "id": "c1",
                "data": {"hp": 5, "max_hp": 10},
            })(),
        ]
        npcs = []

    ctx = type("Ctx", (), {"scene": _Scene()})()
    claim = DamageClaim(
        id="h1",
        source_kind="character",
        source_character_id="c1",
        source_label="Бард",
        target_kind="character",
        target_character_id="c1",
        target_label="Бард",
        formula="1d8",
        hp_effect="heal",
        total_raw=6,
        total_final=6,
        rolled=True,
    )
    patch = build_damage_hp_patches(ctx, claim)
    assert patch["characters"][0]["dataPatch"]["hp"] == 10


def test_post_roll_wizard_includes_hp_stages_for_bard():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.post_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(uid),
                "roll": {"outcome": "hit_10_plus", "required": True},
                "moves": [{"id": "bard_arcane_art", "title": "Тайное искусство", "kind": "class"}],
                "resolve": {},
            },
        },
        stageData={},
    )
    c = PerformMoveContext.model_validate(wf.context)
    steps = PerformMoveWorkflow()._post_roll_wizard_steps(wf, c)
    assert "perform_move.change_manifest" in steps


def test_collect_participating_factories_move_and_codex_fo_only():
    from uuid import uuid4
    from plugins.pbta.base.backend.workflows.perform_move.types import MoveRef
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import collect_participating_factories
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveEntry

    class _Scene:
        characters = []
        npcs = []

    codex = FullCodex()
    moves_map = {**codex.playbooks.playbook_moves_map(), **codex.moves.moves_map()}
    entry = PerformMoveEntry(
        actor_user_id=uuid4(),
        moves=[MoveRef(id="bard_arcane_art", title="Чародейское искусство", kind="class")],
    )
    factories = collect_participating_factories(entry, moves_map, _Scene(), outcome="hit_10_plus")
    ids = {f["id"] for f in factories}
    assert "codex:forward" in ids
    assert "codex:ongoing" in ids
    assert not any(f.get("spec_id") == "hold" for f in factories)
    assert not any(f.get("spec_id") == "prepared_spell" for f in factories)
    assert any(f.get("source") == "move" and f.get("spec_id") == "forward" for f in factories)


def test_consume_forward_keeps_ongoing():
    data = {
        "state": {
            "temp_bonuses": [
                {"id": "f1", "spec_id": "forward", "amount": 1, "consume_on": "roll"},
                {"id": "o1", "spec_id": "ongoing", "amount": 2, "consume_on": "manual"},
            ],
        },
    }
    out = consume_bonuses_patch(data, ["f1", "o1"], only_consume_on="roll")
    left = out["state"]["temp_bonuses"]
    assert len(left) == 1
    assert left[0]["spec_id"] == "ongoing"


def test_apply_spellcasting_prepare_and_spend():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import (
        apply_spellcasting_prepare,
        spend_spell_entry,
        fo_resource_sum,
    )

    data = {
        "spellcasting": {
            "spells": [
                {"id": "s1", "spell_id": "magic_missile", "title": "MM", "level": 1, "prepared": False, "amount": 1},
                {"id": "s2", "spell_id": "light", "title": "Light", "level": 0, "prepared": True, "amount": 1},
            ],
        },
        "state": {"resources": [{"id": "f1", "spec_id": "forward", "amount": 2}]},
    }
    assert fo_resource_sum(data) == 2
    prepared = apply_spellcasting_prepare(data, [{"id": "s1", "prepared": True, "amount": 1}])
    assert prepared["spellcasting"]["spells"][0]["prepared"] is True
    spent = spend_spell_entry(prepared, "s1", unprepare=True)
    assert spent["spellcasting"]["spells"][0]["prepared"] is False


def test_pre_roll_wizard_skips_bonuses_step():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.stage_store import PRE_ROLL_SUBSTEPS
    assert PRE_ROLL_SUBSTEPS == ["perform_move.declare", "perform_move.aid"]


def test_post_roll_includes_change_manifest():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.post_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(uid),
                "roll": {"outcome": "hit_10_plus", "required": True},
                "moves": [{"id": "bard_arcane_art", "title": "Тайное искусство", "kind": "class"}],
                "resolve": {},
            },
        },
        stageData={},
    )
    c = PerformMoveContext.model_validate(wf.context)
    steps = PerformMoveWorkflow()._post_roll_wizard_steps(wf, c)
    assert "perform_move.change_manifest" in steps
    assert "perform_move.affected" not in steps
    assert "perform_move.resources_grant" not in steps


def test_resolve_go_aggro_no_auto_damage_mod_on_hit():
    codex = FullCodex()
    move = codex.moves.moves_map()["go_aggro"]
    effects, _, _ = resolve_dw_move_outcome(move, "hit_10_plus")
    assert not any(e.kind == "apply_damage_mod" for e in effects)


def test_bard_arcane_art_builds_forward_draft_on_10_plus():
    from uuid import uuid4

    from plugins.pbta.base.backend.workflows.perform_move.types import MoveRef
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import build_resource_drafts
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveEntry

    codex = FullCodex()
    moves_map = {**codex.playbooks.playbook_moves_map(), **codex.moves.moves_map()}
    cid = uuid4()
    entry = PerformMoveEntry(
        actor_user_id=uuid4(),
        actor_kind="character",
        actor_character_id=cid,
        moves=[MoveRef(id="bard_arcane_art", title="Тайное искусство", kind="class")],
    )
    drafts = build_resource_drafts(entry, moves_map, "hit_10_plus")
    assert len(drafts) == 1
    assert drafts[0].spec_id == "forward"
    assert drafts[0].amount == 1


def test_post_roll_wizard_includes_damage_roll_for_attack_moves():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.post_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(uid),
                "roll": {"outcome": "hit_10_plus", "required": True},
                "moves": [{"id": "go_aggro", "title": "Руби и кромсай", "kind": "basic"}],
                "resolve": {},
            },
        },
        stageData={},
    )
    c = PerformMoveContext.model_validate(wf.context)
    steps = PerformMoveWorkflow()._post_roll_wizard_steps(wf, c)
    assert "perform_move.change_manifest" in steps
    assert "perform_move.damage_claim" not in steps


def test_post_roll_wizard_order_damage_before_resources():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import (
        DamageClaim,
        PerformMoveContext,
        ResourceDraft,
        ResolveState,
    )

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.post_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(uid),
                "roll": {"outcome": "hit_10_plus", "required": True},
                "moves": [{"id": "hack-and-slash", "title": "Hack and Slash", "kind": "basic"}],
                "resolve": ResolveState(
                    resource_drafts=[
                        ResourceDraft(id="r1", move_id="defend", spec_id="hold", amount=1, target_kind="character", target_id="c1"),
                    ],
                ).model_dump(),
                "damage_claims": [
                    DamageClaim(id="d1", formula="d10", target_kind="npc", target_npc_id="n1").model_dump(),
                ],
            },
        },
        stageData={},
    )
    c = PerformMoveContext.model_validate(wf.context)
    steps = PerformMoveWorkflow()._post_roll_wizard_steps(wf, c)
    assert "perform_move.change_manifest" in steps
    assert "perform_move.damage_roll" in steps
    assert steps.index("perform_move.change_manifest") < steps.index("perform_move.damage_roll")


def test_merge_rolls_by_id_keeps_other_claims():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.stages.damage_roll import (
        _merge_rolls_by_id,
    )

    current = {
        "c1": {"roll_seed": "aaa", "dice": [4]},
        "c2": {"roll_seed": "bbb", "dice": [6]},
    }
    incoming = {"c1": {"roll_seed": "ccc", "dice": [2, 3]}}
    merged = _merge_rolls_by_id(current, incoming, allowed_claim_ids={"c1"})
    assert merged["c1"]["dice"] == [2, 3]
    assert merged["c2"]["dice"] == [6]


def test_merge_rolls_by_id_rejects_disallowed_keys():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.stages.damage_roll import (
        _merge_rolls_by_id,
    )

    current = {"c1": {"dice": [1]}, "c2": {"dice": [2]}}
    incoming = {"c1": {"dice": [9]}, "c2": {"dice": [8]}}
    merged = _merge_rolls_by_id(current, incoming, allowed_claim_ids={"c1"})
    assert merged["c1"]["dice"] == [9]
    assert merged["c2"]["dice"] == [2]


def test_can_patch_damage_roll_for_roller_only():
    from uuid import uuid4
    from plugins.common.protocols import StageCtx
    from plugins.common.types import ActionParticipants
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import (
        PerformMoveContext,
        DamageClaim,
    )

    gm = uuid4()
    actor = uuid4()
    roller = uuid4()
    other = uuid4()
    c = PerformMoveContext.model_validate(
        {
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(actor),
                "damage_claims": [
                    DamageClaim(
                        id="d1",
                        formula="d6",
                        target_kind="npc",
                        target_npc_id="n1",
                        roller_user_id=str(roller),
                    ).model_dump(),
                ],
            },
        }
    )
    participants = ActionParticipants(
        gmUserId=gm,
        initiatorUserId=actor,
        participants=[gm, actor, roller, other],
    )
    wf = PerformMoveWorkflow()

    def ctx_for(uid) -> StageCtx:
        return StageCtx(
            scene=None,  # type: ignore[arg-type]
            actor_user_id=str(uid),
            participants=participants,
            participants_dict=participants,
            rb=None,  # type: ignore[arg-type]
            links=None,  # type: ignore[arg-type]
        )

    assert wf._can_patch_substep(ctx_for(roller), c, "perform_move.damage_roll")
    assert not wf._can_patch_substep(ctx_for(other), c, "perform_move.damage_roll")
    assert not wf._can_patch_substep(ctx_for(roller), c, "perform_move.change_manifest")
    assert not wf._can_submit_substep(ctx_for(roller), c, "perform_move.damage_roll")
    assert wf._can_submit_substep(ctx_for(gm), c, "perform_move.damage_roll")


def test_pre_roll_phase_after_player_skip_setup_has_wizard_steps():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.workflow import PerformMoveWorkflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.stage_store import (
        PRE_ROLL_SUBSTEPS,
        mark_progress,
    )
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext

    uid = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.pre_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_kind": "character",
                "actor_character_id": str(uuid4()),
                "actor_user_id": str(uid),
                "roll": {},
                "moves": [],
            },
        },
        stageData={"moves": [], "draft": {}},
    )
    wf_obj = PerformMoveWorkflow()
    wf_obj._enter_phase(wf, "perform_move.pre_roll", None)  # type: ignore[arg-type]
    c = PerformMoveContext.model_validate(wf.context)
    mark_progress(wf, PRE_ROLL_SUBSTEPS[0])
    wf_obj._attach_wizard(wf, c)
    steps = wf.stageData["wizard"]["steps"]
    assert len(steps) == len(PRE_ROLL_SUBSTEPS)
    assert wf.stageData["wizard"]["currentKey"] == "perform_move.declare"


def test_manifest_prefill_and_sync_damage_lines():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.manifest_sync import (
        claims_need_roll,
        prefill_manifest_from_entry,
        read_manifest,
        sync_manifest_lines_to_entry,
        write_manifest,
    )
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import PerformMoveContext
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types_change_manifest import (
        ManifestLine,
        ManifestTarget,
    )

    class _Entity:
        def __init__(self, eid, name):
            self.id = eid
            self.name = name

    cid = uuid4()
    nid = uuid4()

    class _Scene:
        characters = [_Entity(cid, "Hero")]
        npcs = [_Entity(nid, "Goblin")]

    actor = uuid4()
    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.post_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(actor),
                "actor_kind": "character",
                "actor_character_id": str(cid),
                "roll": {"outcome": "hit_10_plus", "required": True},
                "moves": [{"id": "hack_and_slash", "title": "Hack", "kind": "basic"}],
                "resolve": {
                    "resource_drafts": [
                        {
                            "id": "res_0",
                            "spec_id": "forward",
                            "amount": 1,
                            "target_kind": "character",
                            "target_id": str(cid),
                            "move_id": "hack_and_slash",
                        }
                    ]
                },
            },
        },
        stageData={},
    )
    c = PerformMoveContext.model_validate(wf.context)
    state = prefill_manifest_from_entry(wf, c)
    assert len(state.lines) == 1
    assert state.lines[0].kind == "resource_draft"
    assert state.lines[0].payload["spec_id"] == "forward"

    state.lines.append(
        ManifestLine(
            id="dmg_1",
            kind="damage",
            target=ManifestTarget(kind="npc", id=str(nid), name="Goblin"),
            status="needs_roll",
            label="Урон d6",
            payload={
                "id": "dmg_1",
                "source_kind": "character",
                "source_id": str(cid),
                "target_kind": "npc",
                "target_id": str(nid),
                "damage_expr": "d6",
                "hp_effect": "damage",
            },
        )
    )
    write_manifest(wf, state)
    c = PerformMoveContext.model_validate(wf.context)
    sync_manifest_lines_to_entry(wf, c, _Scene(), mode="edit")
    c = PerformMoveContext.model_validate(wf.context)
    assert len(c.entry.damage_claims) == 1
    assert c.entry.damage_claims[0].formula == "d6"
    assert claims_need_roll(c) is True
    assert any(str(ae.id) == str(nid) for ae in c.entry.affected_entities)
    assert read_manifest(wf).mode == "edit"


def test_attacks_to_damage_claims_preserves_rolled_totals():
    from uuid import uuid4

    class _Entity:
        def __init__(self, eid, name):
            self.id = eid
            self.name = name

    cid, nid = uuid4(), uuid4()

    class _Scene:
        characters = [_Entity(cid, "Hero")]
        npcs = [_Entity(nid, "Goblin")]

    claims = attacks_to_damage_claims(
        [
            {
                "id": "dmg_1",
                "source_kind": "character",
                "source_id": str(cid),
                "target_kind": "npc",
                "target_id": str(nid),
                "damage_expr": "d6",
                "dice": [6],
                "total_raw": 6,
                "total_final": 6,
                "armor_applied": 0,
                "rolled": True,
                "roll_seed": "canvas-seed",
                "allocations": [
                    {"die_index": 0, "value": 6, "target_kind": "npc", "target_id": str(nid)},
                ],
            }
        ],
        scene=_Scene(),
    )
    assert len(claims) == 1
    assert claims[0].rolled is True
    assert claims[0].total_final == 6
    assert claims[0].dice == [6]
    assert claims[0].roll_seed == "canvas-seed"
    assert len(claims[0].dice_allocations) == 1


def test_manifest_apply_preserves_rolled_claim_and_builds_hp_patch():
    from uuid import uuid4
    from plugins.common.types import Workflow
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.engine import build_damage_hp_patches
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.manifest_sync import (
        sync_claims_to_manifest_lines,
        sync_manifest_lines_to_entry,
        write_manifest,
    )
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import (
        DamageClaim,
        DieAllocation,
        PerformMoveContext,
    )
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types_change_manifest import (
        ChangeManifestState,
        ManifestLine,
        ManifestTarget,
    )

    class _Entity:
        def __init__(self, eid, name, data=None, tags=None):
            self.id = eid
            self.name = name
            self.data = data or {}
            self.tags = tags or []

    cid, nid = uuid4(), uuid4()
    npc = _Entity(nid, "Goblin", data={"hp": 10, "hp_current": 10, "armor": 0})

    class _Scene:
        characters = [_Entity(cid, "Hero", data={"hp": 20, "max_hp": 20})]
        npcs = [npc]

    class _Ctx:
        scene = _Scene()

    claim = DamageClaim(
        id="dmg_1",
        source_kind="character",
        source_character_id=str(cid),
        source_label="Hero",
        target_kind="npc",
        target_npc_id=str(nid),
        target_label="Goblin",
        formula="d6",
        roll_seed="seed",
        dice=[6],
        dice_allocations=[
            DieAllocation(die_index=0, value=6, target_kind="npc", target_npc_id=str(nid)),
        ],
        total_raw=6,
        total_final=6,
        rolled=True,
    )

    wf = Workflow(
        actionKey="perform_move",
        stageKey="perform_move.post_roll",
        status="active",
        context={
            "scene_id": str(uuid4()),
            "entry": {
                "actor_user_id": str(uuid4()),
                "actor_kind": "character",
                "actor_character_id": str(cid),
                "damage_claims": [claim.model_dump(mode="json")],
                "moves": [{"id": "hack_and_slash", "title": "Hack", "kind": "basic"}],
            },
        },
        stageData={},
    )
    c = PerformMoveContext.model_validate(wf.context)
    write_manifest(
        wf,
        ChangeManifestState(
            mode="review",
            lines=[
                ManifestLine(
                    id="dmg_1",
                    kind="damage",
                    target=ManifestTarget(kind="npc", id=str(nid), name="Goblin"),
                    status="rolled",
                    label="Урон",
                    payload={
                        "id": "dmg_1",
                        "source_kind": "character",
                        "source_id": str(cid),
                        "target_kind": "npc",
                        "target_id": str(nid),
                        "damage_expr": "d6",
                        "dice": [6],
                        "total_raw": 6,
                        "total_final": 6,
                        "rolled": True,
                    },
                )
            ],
        ),
    )
    sync_claims_to_manifest_lines(wf, c)
    # Simulate FE apply submit rewriting lines without wiping entry first — sync from lines.
    sync_manifest_lines_to_entry(wf, c, _Scene(), mode="review")
    c = PerformMoveContext.model_validate(wf.context)
    assert c.entry.damage_claims[0].rolled is True
    assert c.entry.damage_claims[0].total_final == 6

    patch = build_damage_hp_patches(_Ctx(), c.entry.damage_claims[0])
    assert "npcs" in patch
    assert patch["npcs"][0]["id"] == str(nid)
    assert patch["npcs"][0]["dataPatch"]["hp_current"] == 4
    assert patch["npcs"][0]["dataPatch"]["hp"] == 10
