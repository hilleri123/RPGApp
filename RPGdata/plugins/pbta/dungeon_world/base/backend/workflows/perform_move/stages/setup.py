from __future__ import annotations

from typing import Any
from uuid import UUID

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow
from plugins.pbta.base.backend.workflows.perform_move.stages.setup import (
    PerformMoveSetupStage as PbtaPerformMoveSetupStage,
    SetupInput,
)

from ..stage_store import DwStage
from plugins.pbta.base.backend.custom_moves import active_custom_moves
from ..helpers import (
    actor_resource_totals,
    filter_moves_by_availability,
    codex_moves_map,
    enrich_prepared_spells_for_cast,
    find_npc_attack,
)
from ..types import NpcAttackRef, PerformMoveContext
from ..stage_store import set_stage_data
from plugins.pbta.base.backend.workflows.perform_move.stages.declare import empty_declare_draft
from ....scene_context import scene_context_tags


def character_for_user(scene, links, user_id: UUID):
    for ch in scene.characters or []:
        owner = links.characterToUserId.get(ch.id)
        if owner and str(owner) == str(user_id):
            return ch
    return None


class PerformMoveSetupStage(DwStage, PbtaPerformMoveSetupStage):
    key = "perform_move.setup"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        pass

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.fail("", "Setup stage does not support patch")

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        is_gm = ctx.actor_user_id == ctx.participants.gmUserId
        if not is_gm:
            parsed = ctx.rb.parse_input(SetupInput, raw, wf, ctx)
            if isinstance(parsed, SubmitResult):
                return StageOutcome(ok=False, issues=parsed.issues)
            if not parsed.actor_character_id or parsed.actor_npc_id:
                return StageOutcome.fail("", "Player must select own character")
        return StageOutcome.ok_data(raw)

    def assemble(self, wf: Workflow, ctx: StageCtx, entry: Any) -> None:
        pass

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants, gm_only=True)

    def _allowed_moves(
        self,
        playbook_id: str | None,
        level: int = 1,
        actor_data: dict[str, Any] | None = None,
    ) -> list[dict]:
        playbooks_map = self.full_codex.playbooks.playbooks_map()
        playbook_moves_map = self.full_codex.playbooks.playbook_moves_map()
        global_moves_map = self.full_codex.moves.moves_map()
        chosen = {str(x) for x in ((actor_data or {}).get("moves") or [])}

        result: list[dict] = []
        seen: set[str] = set()

        def push_move(move: Any) -> None:
            if not move:
                return
            move_id = str(getattr(move, "id", "") or "")
            if not move_id or move_id in seen:
                return
            seen.add(move_id)
            result.append(move.model_dump(mode="json"))

        for move in global_moves_map.values():
            if getattr(move, "kind", None) == "basic":
                push_move(move)

        if playbook_id:
            playbook = playbooks_map.get(playbook_id)
            if playbook:
                for move_id in getattr(playbook, "starting_moves", []) or []:
                    move = playbook_moves_map.get(move_id) or global_moves_map.get(move_id)
                    push_move(move)
                if level >= 2:
                    for move_id in getattr(playbook, "advanced_moves", []) or []:
                        if str(move_id) not in chosen:
                            continue
                        move = playbook_moves_map.get(move_id) or global_moves_map.get(move_id)
                        push_move(move)

        for move in active_custom_moves(actor_data):
            push_move(move)

        return sorted(result, key=lambda x: (0 if x.get("kind") == "basic" else 1, x.get("title", "")))

    def apply_actor_character(
        self,
        wf: Workflow,
        ctx,
        *,
        actor_character_id: UUID,
        target_character_id: UUID | None = None,
        target_npc_id: UUID | None = None,
    ) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        ch = next((x for x in (ctx.scene.characters or []) if x.id == actor_character_id), None)
        if ch is None:
            return err("actor_character_id", "Character not found")

        uid = ctx.links.characterToUserId.get(ch.id)
        if uid is None:
            return err("actor_character_id", "Character is not linked to a user")

        entry = c.entry
        entry.actor_kind = "character"
        entry.actor_character_id = ch.id
        entry.actor_npc_id = None
        entry.actor_user_id = uid

        raw_data = ch.data if isinstance(ch.data, dict) else {}
        actor_playbook_id = raw_data.get("playbook_id") if isinstance(raw_data, dict) else None
        actor_level = int(raw_data.get("level", 1) or 1) if isinstance(raw_data, dict) else 1

        if target_character_id:
            target = next((x for x in (ctx.scene.characters or []) if x.id == target_character_id), None)
            if target is None:
                return err("target_character_id", "Target character not found")
            entry.target_kind = "character"
            entry.target_character_id = target.id
            entry.target_npc_id = None
        elif target_npc_id:
            target = next((x for x in (ctx.scene.npcs or []) if x.id == target_npc_id), None)
            if target is None:
                return err("target_npc_id", "Target NPC not found")
            entry.target_kind = "npc"
            entry.target_npc_id = target.id
            entry.target_character_id = None
        else:
            entry.target_kind = "none"
            entry.target_character_id = None
            entry.target_npc_id = None

        wf.context = c.model_dump(mode="json")
        set_stage_data(wf, "perform_move.declare", empty_declare_draft())
        wf.stageData = {
            **(wf.stageData or {}),
            "moves": self._allowed_moves(actor_playbook_id, actor_level, raw_data if isinstance(raw_data, dict) else None),
            "draft": empty_declare_draft(),
            "preparedSpells": enrich_prepared_spells_for_cast(raw_data if isinstance(raw_data, dict) else None, self.full_codex),
        }
        wf.stageKey = "perform_move.pre_roll"

        result = ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
        return self._filter_moves_for_scene(result, ctx)

    def submit(self, wf: Workflow, ctx, input_dict: dict[str, Any]) -> SubmitResult:
        is_gm = ctx.actor_user_id == ctx.participants.gmUserId
        if not is_gm:
            parsed = ctx.rb.parse_input(SetupInput, input_dict, wf, ctx)
            if isinstance(parsed, SubmitResult):
                return parsed
            if not parsed.actor_character_id or parsed.actor_npc_id:
                return ctx.rb.result(
                    ok=False,
                    wf=wf,
                    participants=ctx.participants,
                    participants_dict_fallback=ctx.participants_dict,
                    issues=[issue("actor", "Choose your character")],
                )
            owner = ctx.links.characterToUserId.get(parsed.actor_character_id)
            if owner is None or str(owner) != str(ctx.actor_user_id):
                return ctx.rb.result(
                    ok=False,
                    wf=wf,
                    participants=ctx.participants,
                    participants_dict_fallback=ctx.participants_dict,
                    issues=[issue("actor_character_id", "Only your own character")],
                )
            result = self.apply_actor_character(
                wf,
                ctx,
                actor_character_id=parsed.actor_character_id,
                target_character_id=parsed.target_character_id,
                target_npc_id=parsed.target_npc_id,
            )
            return result

        if input_dict.get("actor_npc_id"):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("actor_npc_id", "NPC не выполняет ход: выберите персонажа, а NPC укажите источником")],
            )

        source = self._resolve_npc_source(wf, ctx, input_dict)
        if isinstance(source, SubmitResult):
            return source

        result = super().submit(wf, ctx, input_dict)
        if not result.ok:
            return result
        result = self._apply_npc_source(result, source)
        return self._filter_moves_for_scene(result, ctx)

    @staticmethod
    def _resolve_npc_source(wf: Workflow, ctx, input_dict: dict[str, Any]) -> tuple | SubmitResult:
        """Проверяет NPC-«повод» хода и его атаку до любых изменений workflow."""
        raw_npc = str(input_dict.get("source_npc_id") or "").strip()
        raw_attack = str(input_dict.get("source_attack_id") or "").strip()
        if not raw_npc:
            return ("", "", None)

        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        npc = next((x for x in (ctx.scene.npcs or []) if str(x.id) == raw_npc), None)
        if npc is None:
            return err("source_npc_id", "NPC не найден в сцене")
        attack = None
        if raw_attack:
            atk = find_npc_attack(npc, raw_attack)
            if atk is None:
                return err("source_attack_id", "У этого NPC нет такой атаки")
            attack = NpcAttackRef(
                id=atk["id"],
                name=atk["name"],
                damage=atk["damage"],
                range_tags=atk["range_tags"],
                attack_tags=atk["attack_tags"],
                description=atk["description"],
            )
        return (str(npc.id), str(getattr(npc, "name", "") or ""), attack)

    @staticmethod
    def _apply_npc_source(result: SubmitResult, source: tuple) -> SubmitResult:
        """Ходит персонаж, а NPC и его атака записываются в ход и идут через все фазы."""
        npc_id, npc_name, attack = source
        try:
            c = PerformMoveContext.model_validate(result.workflow.context or {})
        except Exception:
            return result
        c.entry.source_npc_id = npc_id or None
        c.entry.source_npc_name = npc_name
        c.entry.npc_attack = attack
        result.workflow.context = c.model_dump(mode="json")
        return result

    def _filter_moves_for_scene(self, result: SubmitResult, ctx) -> SubmitResult:
        try:
            c = PerformMoveContext.model_validate(result.workflow.context or {})
        except Exception:
            return result

        actor_data: dict[str, Any] = {}
        if c.entry.actor_kind == "character" and c.entry.actor_character_id:
            ch = next(
                (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
                None,
            )
            if ch and isinstance(ch.data, dict):
                actor_data = ch.data

        context_tags = {str(t) for t in (c.entry.scene_context_tags or [])}
        scene_tags = getattr(ctx.scene, "tags", None) or []
        context_tags.update(str(t) for t in scene_tags)
        scene_data = getattr(ctx.scene, "data", None) or {}
        if isinstance(scene_data, dict):
            context_tags.update(scene_context_tags(scene_data))

        resources = actor_resource_totals(actor_data)
        moves = result.workflow.stageData.get("moves") or []
        move_objs = []
        moves_map = codex_moves_map(self.full_codex, actor_data or None)
        for raw in moves:
            mid = str(raw.get("id") or "")
            mobj = moves_map.get(mid)
            if mobj is not None:
                move_objs.append(mobj)

        filtered = filter_moves_by_availability(
            move_objs,
            actor_resources=resources,
            context_tags=context_tags,
        )
        result.workflow.stageData = {
            **(result.workflow.stageData or {}),
            "moves": [m.model_dump(mode="json") for m in filtered],
            "sceneContextTags": sorted(context_tags),
            "draft": (result.workflow.stageData or {}).get("draft") or empty_declare_draft(),
            "preparedSpells": enrich_prepared_spells_for_cast(actor_data or None, self.full_codex),
        }
        return result
