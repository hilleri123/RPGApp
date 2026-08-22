from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel

from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..types import PerformMoveContext
from .declare import empty_declare_draft
from plugins.pbta.base.backend.custom_moves import active_custom_moves


class SetupInput(BaseModel):
    actor_character_id: Optional[UUID] = None
    actor_npc_id: Optional[UUID] = None
    target_character_id: Optional[UUID] = None
    target_npc_id: Optional[UUID] = None


class PerformMoveSetupStage(BaseStage):
    key = "perform_move.setup"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        if ctx.actor_user_id != ctx.participants.gmUserId:
            return err("", "Only GM can choose actor")

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        parsed = ctx.rb.parse_input(SetupInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if bool(parsed.actor_character_id) == bool(parsed.actor_npc_id):
            return err("actor", "Choose exactly one actor")

        entry = c.entry
        scene = ctx.scene

        actor_playbook_id: str | None = None
        actor_level: int = 1
        actor_data: dict[str, Any] | None = None

        if parsed.actor_character_id:
            ch = next((x for x in (scene.characters or []) if x.id == parsed.actor_character_id), None)
            if ch is None:
                return err("actor_character_id", "Character not found")

            uid = ctx.links.characterToUserId.get(ch.id)
            if uid is None:
                return err("actor_character_id", "Character is not linked to a user")

            entry.actor_kind = "character"
            entry.actor_character_id = ch.id
            entry.actor_npc_id = None
            entry.actor_user_id = uid

            raw_data = ch.data if isinstance(ch.data, dict) else {}
            actor_playbook_id = raw_data.get("playbook_id") if isinstance(raw_data, dict) else None
            actor_level = int(raw_data.get("level", 1) or 1) if isinstance(raw_data, dict) else 1
            actor_data = raw_data

        if parsed.actor_npc_id:
            npc = next((x for x in (scene.npcs or []) if x.id == parsed.actor_npc_id), None)
            if npc is None:
                return err("actor_npc_id", "NPC not found")

            entry.actor_kind = "npc"
            entry.actor_npc_id = npc.id
            entry.actor_character_id = None

        if parsed.target_character_id:
            ch = next((x for x in (scene.characters or []) if x.id == parsed.target_character_id), None)
            if ch is None:
                return err("target_character_id", "Target character not found")
            entry.target_kind = "character"
            entry.target_character_id = ch.id
            entry.target_npc_id = None
        elif parsed.target_npc_id:
            npc = next((x for x in (scene.npcs or []) if x.id == parsed.target_npc_id), None)
            if npc is None:
                return err("target_npc_id", "Target NPC not found")
            entry.target_kind = "npc"
            entry.target_npc_id = npc.id
            entry.target_character_id = None
        else:
            entry.target_kind = "none"
            entry.target_character_id = None
            entry.target_npc_id = None

        wf.context = c.model_dump(mode="json")
        wf.stageData = {
            "moves": self._allowed_moves(actor_playbook_id, actor_level, actor_data),
            "draft": empty_declare_draft(),
        }
        wf.stageKey = "perform_move.declare"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def _allowed_moves(
        self,
        playbook_id: str | None,
        level: int = 1,
        actor_data: dict[str, Any] | None = None,
    ) -> list[dict]:
        playbooks_map = self.full_codex.playbooks.playbooks_map()
        playbook_moves_map = self.full_codex.playbooks.playbook_moves_map()
        global_moves_map = self.full_codex.moves.moves_map()

        result: list[dict] = []
        seen: set[str] = set()

        def push_move(move: Any) -> None:
            if not move:
                return
            move_id = getattr(move, "id", None)
            if not move_id or move_id in seen:
                return
            seen.add(move_id)
            result.append(move.model_dump(mode="json"))

        for move in global_moves_map.values():
            if getattr(move, "kind", None) == "basic":
                push_move(move)

        if not playbook_id:
            for move in active_custom_moves(actor_data):
                push_move(move)
            return sorted(result, key=lambda x: (0 if x.get("kind") == "basic" else 1, x.get("title", "")))

        playbook = playbooks_map.get(playbook_id)
        if not playbook:
            for move in active_custom_moves(actor_data):
                push_move(move)
            return sorted(result, key=lambda x: (0 if x.get("kind") == "basic" else 1, x.get("title", "")))

        for move_id in getattr(playbook, "starting_moves", []) or []:
            move = playbook_moves_map.get(move_id) or global_moves_map.get(move_id)
            push_move(move)

        if level >= 2:
            for move_id in getattr(playbook, "advanced_moves", []) or []:
                move = playbook_moves_map.get(move_id) or global_moves_map.get(move_id)
                push_move(move)

        for move in active_custom_moves(actor_data):
            push_move(move)

        return sorted(result, key=lambda x: (0 if x.get("kind") == "basic" else 1, x.get("title", "")))