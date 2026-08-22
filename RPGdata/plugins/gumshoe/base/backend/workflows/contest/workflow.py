# plugins/gumshoe/contest/workflow.py
from __future__ import annotations

from typing import List, Any, Tuple

from plugins.common.types import (
    ActionParticipants,
    ActionContext,
    SceneContext,
    ActionRole,
    Workflow,
    SubmitResult,
    ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue

from .types import ContestContext, ContestEntry, ContestRound, ContestParticipant
from ...codex import FullCodex
from ...types import CharacterData, NpcData
from .stages.contest_setup import ContestSetupStage
from .stages.contest_spend import ContestSpendStage
from .stages.contest_roll import ContestRollStage
from .stages.contest_result import ContestResultStage


def _uniq(xs):
    out, seen = [], set()
    for x in xs:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


class ContestWorkflow:
    key = "gumshoe.contest"

    def __init__(self, full_codex: FullCodex):
        self.full_codex = full_codex
        self._stages = {
            ContestSetupStage.key: ContestSetupStage(self.full_codex),
            ContestSpendStage.key: ContestSpendStage(self.full_codex),
            ContestRollStage.key: ContestRollStage(self.full_codex),
            ContestResultStage.key: ContestResultStage(self.full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> List[ActionInfo]:
        if role != "gm":
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Состязание",
                roles=["gm"],
                description="Соревновательный бросок между двумя участниками",
            )
        ]

    def _participants_fallback_ids(self, d):
        ids = []
        if gm := (d or {}).get("gmUserId"):
            ids.append(str(gm))
        for u in (d or {}).get("participants") or []:
            ids.append(str(u))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> List[str]:
        gm_id = str(participants.gmUserId)
        try:
            c = ContestContext.model_validate(wf.context or {})
            entry = c.entry
        except Exception:
            return [gm_id]

        a_uid = str(entry.side_a.userId) if entry.side_a.userId else None
        b_uid = str(entry.side_b.userId) if entry.side_b.userId else None
        stage = wf.stageKey

        if stage == ContestSetupStage.key:
            return [gm_id]

        if stage == ContestSpendStage.key:
            ids = [gm_id]
            if a_uid:
                ids.append(a_uid)
            if b_uid:
                ids.append(b_uid)
            return _uniq(ids)

        if stage == ContestRollStage.key:
            ids = [gm_id]
            if a_uid:
                ids.append(a_uid)
            if b_uid:
                ids.append(b_uid)
            return _uniq(ids)

        ids = [gm_id]
        if a_uid:
            ids.append(a_uid)
        if b_uid:
            ids.append(b_uid)
        return _uniq(ids)

    def start(self, action_context: ActionContext) -> SubmitResult:
        if action_context.actorUserId != action_context.participants.gmUserId:
            return SubmitResult(
                ok=False,
                issues=[issue("", "Only GM can start contest")],
                workflow=None,
                participantIds=[],
            )

        ctx = ContestContext(
            sceneId=action_context.scene.id,
            **self.full_codex.skills.as_config(),
        )
        wf = Workflow(
            actionKey=self.key,
            stageKey=ContestSetupStage.key,
            status="active",
            context=ctx.model_dump(mode="json"),
        )
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        if wf is None:
            return self._rb.result(
                ok=False,
                wf=None,
                participants=None,
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("workflow", "Missing")],
            )

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        prev_stage = wf.stageKey

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Unknown stage")],
            )

        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )

        res = stage.submit(wf, ctx, action_context.input or {})
        if not (isinstance(res, SubmitResult) and res.ok):
            return res

        if prev_stage == ContestResultStage.key:
            action = str((action_context.input or {}).get("action") or "").strip()

            if action == "finish":
                return self._finish(action_context, wf)

            if action == "next_round":
                wf.stageKey = ContestSpendStage.key
                wf.status = "active"
                return self._rb.result(
                    ok=True,
                    wf=wf,
                    participants=participants,
                    participants_dict_fallback=participants_dict,
                    issues=[],
                )

        return res

    def _get_round_side(self, r: Any, side_key: str):
        if r is None:
            return None
        if isinstance(r, dict):
            return r.get(side_key)
        return getattr(r, side_key, None)

    def _get_side_spent(self, side: Any) -> int:
        if side is None:
            return 0
        if isinstance(side, dict):
            return int(side.get("skill_points") or side.get("skillpoints") or 0)
        return int(getattr(side, "skill_points", None) or getattr(side, "skillpoints", None) or 0)

    def _sum_round_spend(self, rounds: list[Any]) -> Tuple[int, int]:
        spent_a = 0
        spent_b = 0

        for r in rounds or []:
            side_a = self._get_round_side(r, "side_a")
            side_b = self._get_round_side(r, "side_b")
            spent_a += self._get_side_spent(side_a)
            spent_b += self._get_side_spent(side_b)

        return spent_a, spent_b

    def _finish(self, action_context: ActionContext, wf: Workflow) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        try:
            c = ContestContext.model_validate(wf.context or {})
        except Exception as e:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("context", str(e))],
            )

        entry: ContestEntry = c.entry
        scene = action_context.scene

        wf.status = "completed"
        wf.stageKey = "completed"

        entry.side_a.canvas_seed = ''
        entry.side_b.canvas_seed = ''
        for r in entry.rounds:
            r: ContestRound
            r.side_a.canvas_seed = ''
            r.side_b.canvas_seed = ''
        wf.context = c.model_dump()

        patch: dict[str, list[dict]] = {}

        def _find_char(char_id: Any):
            return next(
                (ch for ch in (scene.characters or []) if str(ch.id) == str(char_id)),
                None,
            )

        def _find_npc(npc_id: Any):
            return next(
                (n for n in (scene.npcs or []) if str(n.id) == str(npc_id)),
                None,
            )

        def _spend_from_skill_on_char(char_obj, skill_id: str, spent: int):
            if not char_obj or not skill_id or spent <= 0:
                return
            char_data = CharacterData.model_validate(char_obj.data)
            current = max(0, int(char_data.skills.get(skill_id, 0) or 0))
            char_data.skills[skill_id] = max(0, current - spent)
            patch.setdefault("characters", []).append(
                {
                    "id": str(char_obj.id),
                    "dataPatch": char_data.model_dump(mode="json"),
                }
            )

        def _spend_from_skill_on_npc(npc_obj, skill_id: str, spent: int):
            if not npc_obj or not skill_id or spent <= 0:
                return
            npc_data = NpcData.model_validate(npc_obj.data)
            current = max(0, int((npc_data.skills or {}).get(skill_id, 0) or 0))
            npc_data.skills = {**(npc_data.skills or {}), skill_id: max(0, current - spent)}
            patch.setdefault("npcs", []).append(
                {
                    "id": str(npc_obj.id),
                    "dataPatch": npc_data.model_dump(mode="json"),
                }
            )

        spent_a, spent_b = self._sum_round_spend(list(entry.rounds or []))

        def _apply_spend(side: Any, spent_total: int):
            skill_id = str(entry.skill_id or "")
            if spent_total <= 0 or not skill_id:
                return

            if side.characterId:
                ch = _find_char(side.characterId)
                _spend_from_skill_on_char(ch, skill_id, spent_total)
            elif side.npcId:
                npc = _find_npc(side.npcId)
                _spend_from_skill_on_npc(npc, skill_id, spent_total)

        _apply_spend(entry.side_a, spent_a)
        _apply_spend(entry.side_b, spent_b)

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
            sessionPatch=patch or None,
        )
