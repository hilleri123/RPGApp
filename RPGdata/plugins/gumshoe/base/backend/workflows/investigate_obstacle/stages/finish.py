# plugins/gumshoe/investigate_obstacle/stages/finish.py
from __future__ import annotations
from typing import Any, Dict, List
from collections import defaultdict
from uuid import UUID

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue

from ..types import InvestigateContext
from ....types import CharacterData, ObstacleData   # ObstacleData из твоего gumshoe-модуля


class InvestigateResultStage(BaseStage):
    key = "gumshoe.investigate.result"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        # только мастер завершает
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only GM can close")],
            )

        # читаем контекст
        try:
            c = InvestigateContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        entry = c.entry
        if entry is None:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("entry", "No entry in context")],
            )

        # помечаем workflow как завершённый
        wf.stageKey = "completed"
        wf.status = "completed"

        # ---------- 1) Списание очков со скиллов персонажа ----------

        # суммируем подтверждённые spend'ы по скиллам
        spent_by_skill: Dict[str, int] = defaultdict(int)
        for r in entry.spend_records:
            if r.confirmed:
                spent_by_skill[r.skill_name] += r.cost

        # достаем персонажа
        char = next(
            (ch for ch in (ctx.scene.characters or []) if ch.id == entry.characterId),
            None,
        )
        char_data = CharacterData.model_validate(char.data) if char else CharacterData()

        new_skills = dict(char_data.skills)
        for skill, spent in spent_by_skill.items():
            cur = new_skills.get(skill, 0)
            new_skills[skill] = max(0, cur - spent)

        characters_patch: List[dict[str, Any]] = []
        if spent_by_skill:
            characters_patch.append({
                "id": str(entry.characterId),
                "dataPatch": {
                    "skills": new_skills,
                },
            })

        # ---------- 2) Обновление ObstacleData (purchased_by в ClueSpend) ----------

        # Берём obstacle-снимок из контекста
        obstacle_ctx: ObstacleData = c.obstacle

        # карта названия ClueSpend -> playerUserId (один игрок)
        purchased_spend_names = {
            r.clue_spend_name
            for r in entry.spend_records
            if r.confirmed
        }

        updated_spends: List[dict[str, Any]] = []
        for spend in obstacle_ctx.spends:
            data = spend.model_dump(mode="json")
            if spend.name in purchased_spend_names:
                # добавляем игрока в purchased_by
                existing = {str(u) for u in (spend.purchased_by or [])}
                existing.add(str(entry.playerUserId))
                data["purchased_by"] = list(existing)
            updated_spends.append(data)

        obstacles_patch: List[dict[str, Any]] = []

        if purchased_spend_names:
            # здесь мы не читаем, а только патчим, поэтому просто шлём dataPatch
            obstacles_patch.append({
                "id": str(c.entry.obstacle_id),
                "dataPatch": c.obstacle.model_dump(mode="json")
            })

        session_patch: dict[str, Any] = {}

        if characters_patch:
            session_patch["characters"] = characters_patch

        # TODO
        # if obstacles_patch:
        #     session_patch["obstacles"] = obstacles_patch

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=session_patch if session_patch else None,
        )
