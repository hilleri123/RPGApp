# plugins/gumshoe/attack/workflow.py
from __future__ import annotations
from typing import Any, List

from plugins.common.types import (
    ActionParticipants, ActionContext, SceneContext,
    ActionRole, Workflow, SubmitResult, ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue

from .types import AttackContext, AttackEntry
from .stages.attack_setup import AttackSetupStage
from .stages.attack_roll import AttackRollStage
from .stages.attack_result import AttackResultStage
from .stages.attack_damage import AttackDamageStage

from ...types import CharacterData, NpcData
from ...codex import FullCodex


def _uniq(xs):
    out, seen = [], set()
    for x in xs:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


class AttackWorkflow:
    key = "gumshoe.attack"

    def __init__(self, full_codex: FullCodex):
        self.full_codex = full_codex
        self._stages = {
            AttackSetupStage.key: AttackSetupStage(self.full_codex),
            AttackRollStage.key: AttackRollStage(self.full_codex),
            AttackResultStage.key: AttackResultStage(self.full_codex),
            AttackDamageStage.key: AttackDamageStage(self.full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    # кнопка действия
    def actions_for(self, scene: SceneContext, role: ActionRole) -> List[ActionInfo]:
        if role != "player" and role != "gm":
            return []

        if not scene.npcs:
            return []

        return [ActionInfo(
            key=self.key,
            title="Атаковать",
            roles=["player", "gm"],
            description="Персонаж атакует NPC с выбранным оружием",
        )]

    def _participants_fallback_ids(self, d):
        ids = []
        if gm := (d or {}).get("gmUserId"): ids.append(str(gm))
        for u in (d or {}).get("participants") or []: ids.append(str(u))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> List[str]:
        try:
            c = AttackContext.model_validate(wf.context or {})
            attacker_uid = str(c.entry.attackerUserId)
        except Exception:
            attacker_uid = None

        gm_id = str(participants.gmUserId)
        stage = wf.stageKey if wf else None

        if stage == AttackSetupStage.key:
            return _uniq([attacker_uid] if attacker_uid else [])

        if stage == AttackRollStage.key:
            return _uniq([attacker_uid] if attacker_uid else [])
        
        if stage == AttackDamageStage.key:
            return _uniq([attacker_uid] if attacker_uid else [])

        if stage == AttackResultStage.key:
            # и игрок, и мастер видят результат
            ids = [gm_id]
            if attacker_uid:
                ids.append(attacker_uid)
            return _uniq(ids)

        if stage == "completed":
            ids = [gm_id]
            if attacker_uid:
                ids.append(attacker_uid)
            return _uniq(ids)

        return _uniq([gm_id] + ([attacker_uid] if attacker_uid else []))

    def start(self, action_context: ActionContext) -> SubmitResult:
        scene    = action_context.scene
        actor_id = action_context.actorUserId
        links    = action_context.links
        is_gm    = actor_id == action_context.participants.gmUserId

        if is_gm:
            # GM сам выберет атакующего на стадии setup
            entry = AttackEntry(attackerUserId=actor_id)
        else:
            char = next(
                (ch for ch in (scene.characters or [])
                if links.characterToUserId.get(ch.id) == actor_id),
                None,
            )
            if char is None:
                return self._rb.result(
                    ok=False,
                    wf=None,
                    participants=participants,
                    participants_dict_fallback=participants_dict,
                    issues=[issue('scene', 'Actor has no character in this scene')],
                )
            entry = AttackEntry(
                attackerUserId=actor_id,
                attackerCharacterId=char.id,
            )

        ctx = AttackContext(sceneId=scene.id, entry=entry)

        wf = Workflow(
            actionKey=self.key,
            stageKey=AttackSetupStage.key,
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
        prev_stage = wf.stageKey  # 👈 нам нужно знать, что было до вызова

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(
                ok=False, wf=wf, participants=participants,
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

        # Финал: GM нажал кнопку на AttackResultStage
        if prev_stage == AttackResultStage.key:
            return self._finish(action_context, wf)

        return res
    
    def _finish(self, action_context: ActionContext, wf: Workflow) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        try:
            c = AttackContext.model_validate(wf.context or {})
        except Exception as e:
            return self._rb.result(
                ok=False, wf=wf, participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("context", str(e))],
            )

        entry: AttackEntry = c.entry
        wf.status   = "completed"
        wf.stageKey = "completed"

        scene = action_context.scene
        patch: dict[str, list[dict]] = {}
        codex = self.full_codex.skills
        health_id = codex.health_skill().id

        # ── 1. Списываем skill_points у атакующего персонажа ──────────────────────
        if entry.attackerCharacterId and entry.skill_id and entry.skill_points > 0:
            attacker_char = next(
                (ch for ch in (scene.characters or []) if str(ch.id) == str(entry.attackerCharacterId)),
                None,
            )
            if attacker_char:
                char_data = CharacterData.model_validate(attacker_char.data)
                current = max(0, char_data.skills.get(entry.skill_id, 0))
                char_data.skills[entry.skill_id] = max(0, current - entry.skill_points)
                patch.setdefault("characters", []).append({
                    "id": str(attacker_char.id),
                    "dataPatch": char_data.model_dump(mode="json"),
                })

        # ── 2. Применяем урон к цели ──────────────────────────────────────────────
        if entry.targetNpcId:
            target_npc = next(
                (n for n in (scene.npcs or []) if str(n.id) == str(entry.targetNpcId)), None
            )
            if target_npc:
                tags = list(target_npc.tags or [])
                npc_data = NpcData.model_validate(target_npc.data)

                current_hp = (npc_data.skills or {}).get(health_id, 0)
                new_hp = current_hp - entry.damage_total
                npc_data.skills = {**(npc_data.skills or {}), health_id: new_hp}

                if new_hp <= 0 and "dead" not in tags:
                    tags.append("dead")

                patch.setdefault("npcs", []).append({
                    "id": str(target_npc.id),
                    "dataPatch": npc_data.model_dump(mode="json"),
                    "tagsPatch": tags,
                })

        elif entry.targetCharacterId:
            target_char = next(
                (ch for ch in (scene.characters or []) if str(ch.id) == str(entry.targetCharacterId)),
                None,
            )
            if target_char:
                char_data = CharacterData.model_validate(target_char.data)
                current_hp = (char_data.skills or {}).get(health_id, 0)
                new_hp = current_hp - entry.damage_total
                char_data.skills = {**(char_data.skills or {}), health_id: new_hp}

                # Тег "dead" у персонажа — по желанию, зависит от твоей системы
                patch.setdefault("characters", []).append({
                    "id": str(target_char.id),
                    "dataPatch": char_data.model_dump(mode="json"),
                })

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
            sessionPatch=patch or None,
        )
