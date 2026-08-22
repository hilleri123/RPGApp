"""Per-stage data storage for DW perform_move."""

from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import Stage
from plugins.common.types import ActionParticipants, Workflow
from plugins.pbta.base.backend.workflows.perform_move.helpers import uniq
from plugins.pbta.base.backend.workflows.perform_move.types import AidState

from .types import PerformMoveContext, ResolveState

PIPELINE: list[str] = [
    "perform_move.setup",
    "perform_move.pre_roll",
    "perform_move.roll",
    "perform_move.post_roll",
    "perform_move.result",
]

PRE_ROLL_SUBSTEPS: list[str] = [
    "perform_move.declare",
    "perform_move.aid",
]

POST_ROLL_INTERACTIVE: list[str] = [
    "perform_move.choose",
    "perform_move.change_manifest",
    "perform_move.damage_roll",
]

SUBSTEP_ORDER: list[str] = [
    "perform_move.declare",
    "perform_move.bonuses",
    "perform_move.aid",
    "perform_move.roll",
    "perform_move.resolve",
    "perform_move.choose",
    "perform_move.change_manifest",
    "perform_move.damage_roll",
    "perform_move.damage_apply",
    "perform_move.apply",
    "perform_move.resources_grant",
]

STAGE_LABELS: dict[str, str] = {
    "perform_move.setup": "Настройка",
    "perform_move.pre_roll": "Подготовка",
    "perform_move.roll": "Бросок",
    "perform_move.post_roll": "Разбор",
    "perform_move.result": "Итог",
    "perform_move.declare": "Ход",
    "perform_move.bonuses": "Бонусы",
    "perform_move.aid": "Помощь",
    "perform_move.choose": "Выбор",
    "perform_move.change_manifest": "Заявка",
    "perform_move.damage_roll": "Бросок HP",
}


def stage_index(key: str) -> int:
    try:
        return PIPELINE.index(key)
    except ValueError:
        return 999


def substep_index(key: str) -> int:
    try:
        return SUBSTEP_ORDER.index(key)
    except ValueError:
        return 999


def phase_for_substep(key: str) -> str | None:
    if key in PRE_ROLL_SUBSTEPS:
        return "perform_move.pre_roll"
    if key in POST_ROLL_INTERACTIVE or key in (
        "perform_move.resolve",
        "perform_move.damage_roll",
        "perform_move.damage_apply",
        "perform_move.apply",
        "perform_move.change_manifest",
        "perform_move.resources_grant",
    ):
        return "perform_move.post_roll"
    if key == "perform_move.roll":
        return "perform_move.roll"
    if key == "perform_move.setup":
        return "perform_move.setup"
    if key in ("perform_move.result", "completed"):
        return "perform_move.result"
    return None


def _stages_bucket(wf: Workflow) -> dict[str, dict[str, Any]]:
    sd = dict(wf.stageData or {})
    stages = sd.get("stages")
    if not isinstance(stages, dict):
        stages = {}
        legacy_drafts = sd.get("drafts")
        if isinstance(legacy_drafts, dict):
            stages.update({k: dict(v) for k, v in legacy_drafts.items() if isinstance(v, dict)})
        legacy_declare = sd.get("draft")
        if isinstance(legacy_declare, dict) and "perform_move.declare" not in stages:
            stages["perform_move.declare"] = dict(legacy_declare)
    sd["stages"] = stages
    wf.stageData = sd
    return stages


def get_stage_data(wf: Workflow, stage_key: str) -> dict[str, Any]:
    stages = _stages_bucket(wf)
    raw = stages.get(stage_key)
    return dict(raw) if isinstance(raw, dict) else {}


def set_stage_data(wf: Workflow, stage_key: str, data: dict[str, Any]) -> None:
    stages = _stages_bucket(wf)
    stages[stage_key] = dict(data)
    sd = dict(wf.stageData or {})
    sd["stages"] = stages
    drafts = dict(sd.get("drafts") or {})
    drafts[stage_key] = dict(data)
    sd["drafts"] = drafts
    if stage_key == "perform_move.declare":
        sd["draft"] = dict(data)
    wf.stageData = sd


def merge_stage_data(wf: Workflow, stage_key: str, patch: dict[str, Any]) -> dict[str, Any]:
    cur = get_stage_data(wf, stage_key)
    cur.update(patch)
    set_stage_data(wf, stage_key, cur)
    return cur


def furthest_stage_key(wf: Workflow) -> str:
    """Furthest reachable sub-step — never behind currentKey or an active phase that is itself a sub-step."""
    wizard = (wf.stageData or {}).get("wizard") or {}
    furthest = str(wizard.get("furthestKey") or "")
    current = str(wizard.get("currentKey") or "")
    phase = str(wf.stageKey or "")
    candidates = [k for k in (furthest, current, phase) if k in SUBSTEP_ORDER]
    if not candidates:
        return PRE_ROLL_SUBSTEPS[0]
    return max(candidates, key=substep_index)


def mark_progress(wf: Workflow, stage_key: str) -> None:
    sd = dict(wf.stageData or {})
    wizard = dict(sd.get("wizard") or {})
    cur = str(wizard.get("furthestKey") or "")
    if substep_index(stage_key) >= substep_index(cur):
        wizard["furthestKey"] = stage_key
    visited = list(wizard.get("visited") or [])
    if stage_key and stage_key not in visited:
        visited.append(stage_key)
    wizard["visited"] = visited
    sd["wizard"] = wizard
    wf.stageData = sd


def is_roll_frozen(c) -> bool:
    return len(c.entry.roll.dice or []) >= 2


def reset_entry_after(entry: Any, from_stage_key: str) -> None:
    from_idx = substep_index(from_stage_key)

    if from_idx < substep_index("perform_move.bonuses"):
        entry.roll.temp_bonus_ids = []
        entry.resource_bonus_total = 0

    if from_idx < substep_index("perform_move.aid"):
        entry.aid = AidState()
        entry.roll.aid_bonus = 0

    if from_idx < substep_index("perform_move.roll"):
        roll = entry.roll
        roll.roll_seed = ""
        roll.dice = []
        roll.total = 0
        roll.outcome = None
        roll.result_text = ""

    if from_idx < substep_index("perform_move.resolve"):
        entry.resolve = ResolveState()

    if from_idx < substep_index("perform_move.change_manifest"):
        entry.damage_claims = []
        entry.affected_entities = []
        entry.grant_cursor = 0
        entry.resource_grants = []


class DwStage(Stage):
    """Stage data bucket + visibility helpers."""

    def __init__(self, full_codex):
        self.full_codex = full_codex

    def clear(self, wf: Workflow) -> None:
        set_stage_data(wf, self.key, {})

    def get(self, wf: Workflow) -> dict[str, Any]:
        return get_stage_data(wf, self.key)

    def put(self, wf: Workflow, data: dict[str, Any]) -> None:
        set_stage_data(wf, self.key, dict(data))

    def _context(self, wf: Workflow) -> PerformMoveContext:
        return PerformMoveContext.model_validate(wf.context or {})

    def _actor_or_gm(self, ctx: StageCtx, c: PerformMoveContext) -> bool:
        return str(ctx.actor_user_id) in (
            str(c.entry.actor_user_id),
            str(ctx.participants.gmUserId),
        )

    def _gm_actor_helper_visibility(
        self,
        wf: Workflow,
        ctx: StageCtx,
        participants: ActionParticipants,
        *,
        gm_only: bool = False,
        include_rollers: bool = False,
    ) -> list[str]:
        gm_id = str(participants.gmUserId)
        if gm_only:
            return uniq([gm_id])
        try:
            c = self._context(wf)
            actor_uid = str(c.entry.actor_user_id)
            helper_uid = str(c.entry.aid.helper_user_id) if c.entry.aid.helper_user_id else None
            roller_uids = []
            if include_rollers:
                roller_uids = [
                    str(cl.roller_user_id)
                    for cl in (c.entry.damage_claims or [])
                    if cl.roller_user_id
                ]
        except Exception:
            actor_uid = None
            helper_uid = None
            roller_uids = []
        return uniq([gm_id, actor_uid, helper_uid, *roller_uids])


def invalidate_subsequent(wf: Workflow, from_stage_key: str) -> list[str]:
    cleared = [k for k in SUBSTEP_ORDER if substep_index(k) > substep_index(from_stage_key)]
    try:
        c = PerformMoveContext.model_validate(wf.context or {})
    except Exception:
        return cleared
    for key in cleared:
        set_stage_data(wf, key, {})
    reset_entry_after(c.entry, from_stage_key)
    wf.context = c.model_dump(mode="json")
    phase = phase_for_substep(from_stage_key)
    if phase and stage_index(wf.stageKey or "") > stage_index(phase):
        wf.stageKey = phase
    wizard = dict((wf.stageData or {}).get("wizard") or {})
    wizard["currentKey"] = from_stage_key
    wf.stageData = {**(wf.stageData or {}), "wizard": wizard}
    return cleared


def assemble_context(wf: Workflow, ctx: Any, c) -> Any:
    """Legacy assembly for declare/bonuses/aid — prefer stage.assemble()."""
    from .helpers import list_consumable_bonuses
    from plugins.pbta.base.backend.workflows.perform_move.stages.declare import union_stats_for_moves

    declare = get_stage_data(wf, "perform_move.declare")
    if declare:
        move_ids = [str(x) for x in (declare.get("move_ids") or [])]
        if move_ids:
            from ...codex import FullCodex
            from plugins.pbta.base.backend.workflows.perform_move.types import MoveRef

            from .helpers import actor_data_from_scene, codex_moves_map

            codex = FullCodex()
            moves_map = codex_moves_map(codex, actor_data_from_scene(c, ctx.scene))

            resolved: list[MoveRef] = []
            for mid in move_ids:
                move = moves_map.get(mid)
                if move is None:
                    continue
                resolved.append(MoveRef(
                    id=move.id,
                    title=move.title,
                    kind=getattr(move, "kind", ""),
                ))
            if resolved:
                c.entry.moves = resolved

            available_stats = union_stats_for_moves(move_ids, moves_map)
            roll_required = len(available_stats) > 0
            c.entry.roll.required = roll_required
            c.entry.roll.local_bonus = int(declare.get("local_bonus") or 0)

            stat_id = str(declare.get("stat_id") or "")
            if roll_required and stat_id:
                actor = None
                if c.entry.actor_kind == "character" and c.entry.actor_character_id:
                    actor = next(
                        (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
                        None,
                    )
                if actor and isinstance(actor.data, dict):
                    stat_modifiers = actor.data.get("stat_modifiers", {})
                    stats = actor.data.get("stats", {})
                    c.entry.roll.stat_id = stat_id
                    c.entry.roll.stat_value = int(stats.get(stat_id, 0))
                    c.entry.roll.base_modifier = int(stat_modifiers.get(stat_id, 0))
            elif not roll_required:
                c.entry.roll.stat_id = ""
                c.entry.roll.stat_value = 0
                c.entry.roll.base_modifier = 0

    bonuses = get_stage_data(wf, "perform_move.bonuses")
    declare_data = declare or {}
    if bonuses or declare_data.get("consume_bonus_ids") is not None:
        selected = list(
            (bonuses or {}).get("consume_bonus_ids")
            or declare_data.get("consume_bonus_ids")
            or []
        )
        c.entry.roll.temp_bonus_ids = selected

        actor = None
        if c.entry.actor_kind == "character" and c.entry.actor_character_id:
            actor = next(
                (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
                None,
            )
        move_ids = [m.id for m in c.entry.moves]
        available = list_consumable_bonuses(
            actor.data if actor and isinstance(actor.data, dict) else {},
            stat_id=c.entry.roll.stat_id or "",
            move_ids=move_ids,
        )
        bonus_total = sum(int(b.get("amount") or 0) for b in available if b["id"] in selected)
        c.entry.resource_bonus_total = bonus_total
        if declare_data:
            c.entry.cast_spell_entry_id = str(declare_data.get("cast_spell_entry_id") or "")
            c.entry.cast_spell_id = str(declare_data.get("cast_spell_id") or "")
            c.entry.cast_spell_title = str(declare_data.get("cast_spell_title") or "")
        wf.stageData = {
            **(wf.stageData or {}),
            "bonusOptions": available,
            "selectedBonusIds": selected,
            "resourceBonusTotal": bonus_total,
            "foSum": sum(int(b.get("amount") or 0) for b in available),
        }

    aid = get_stage_data(wf, "perform_move.aid")
    if aid:
        c.entry.aid.requested = bool(aid.get("request_aid"))
        if not c.entry.aid.requested:
            c.entry.aid.helper_user_id = None
            c.entry.aid.helper_character_id = None
            c.entry.aid.accepted = None
            c.entry.aid.bonus_amount = 0
        else:
            helper_id = aid.get("helper_character_id")
            if helper_id:
                helper = next(
                    (x for x in (ctx.scene.characters or []) if str(x.id) == str(helper_id)),
                    None,
                )
                if helper:
                    helper_uid = ctx.links.characterToUserId.get(helper.id)
                    c.entry.aid.helper_character_id = helper.id
                    c.entry.aid.helper_user_id = helper_uid
            accepted = aid.get("accept")
            if accepted is not None:
                c.entry.aid.accepted = bool(accepted)
            c.entry.aid.bonus_amount = 1 if c.entry.aid.accepted else 0
        c.entry.roll.aid_bonus = c.entry.aid.bonus_amount

    return c
