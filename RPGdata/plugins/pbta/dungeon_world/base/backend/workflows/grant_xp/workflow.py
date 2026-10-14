"""Мастер выдаёт опыт: число и комментарий, строка plugin:dw:xp на каждого."""

from __future__ import annotations

from typing import Any

from plugins.common.protocols import ResultBuilder, issue
from plugins.common.types import (
    ActionContext,
    ActionInfo,
    ActionParticipants,
    ActionRole,
    SubmitResult,
    Workflow,
)

KIND_DW_XP = "plugin:dw:xp"


def _uniq(xs: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in xs:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _character_data(character) -> dict:
    raw = getattr(character, "data", None)
    if isinstance(raw, dict):
        return raw
    if isinstance(character, dict):
        data = character.get("data")
        return data if isinstance(data, dict) else {}
    return {}


class GrantXpWorkflow:
    key = "grant_xp"

    def __init__(self, full_codex: Any) -> None:
        self.full_codex = full_codex
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene, role: ActionRole) -> list[ActionInfo]:
        if role != "gm":
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Выдать опыт",
                roles=["gm"],
                description="Мастер отмечает, кому и за что выдать опыт",
            )
        ]

    def _participants_fallback_ids(self, data: dict | None) -> list[str]:
        ids: list[str] = []
        if gm := (data or {}).get("gmUserId"):
            ids.append(str(gm))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow | None) -> list[str]:
        if wf and wf.status == "completed":
            return []
        return _uniq([str(participants.gmUserId)] if participants.gmUserId else [])

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        if str(action_context.actorUserId) != str(participants.gmUserId):
            return self._fail(participants, participants_dict, "Только мастер выдаёт опыт")

        characters = [
            {"id": str(character.id), "name": str(getattr(character, "name", "") or "")}
            for character in (action_context.scene.characters or [])
        ]
        wf = Workflow(
            actionKey=self.key,
            stageKey="grant_xp.form",
            status="active",
            context={"scene_id": str(action_context.scene.id)},
            stageData={"characters": characters, "amount": 1},
        )
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        if wf is None:
            return self._fail(participants, participants_dict, "Нет хода")
        if str(action_context.actorUserId) != str(participants.gmUserId):
            return self._fail(participants, participants_dict, "Только мастер выдаёт опыт", wf)

        raw = action_context.input if isinstance(action_context.input, dict) else {}
        ids = [str(item) for item in (raw.get("character_ids") or []) if item]
        try:
            amount = int(raw.get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0
        comment = str(raw.get("comment") or "").strip()
        if not ids:
            return self._fail(participants, participants_dict, "Выберите персонажа", wf)
        if amount == 0:
            return self._fail(participants, participants_dict, "Укажите число опыта", wf)

        by_id = {str(character.id): character for character in (action_context.scene.characters or [])}
        patches = []
        lines = []
        missing = [cid for cid in ids if cid not in by_id]
        if missing:
            return self._fail(participants, participants_dict, "Персонаж не в этой сцене", wf)
        for cid in ids:
            data = _character_data(by_id[cid])
            new_xp = int(data.get("xp") or 0) + amount
            patches.append({"id": cid, "dataPatch": {"xp": new_xp}})
            lines.append({
                "kind": KIND_DW_XP,
                "text": comment,
                "subject_kind": "character",
                "subject_id": cid,
                "payload": {"amount": amount},
                "render": True,
            })

        wf.status = "completed"
        wf.stageKey = "grant_xp.done"
        wf.stageData = {**(wf.stageData or {}), "amount": amount, "comment": comment, "character_ids": ids}
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
            sessionPatch={"characters": patches},
            chronicleLines=lines,
            can_close=True,
        )

    def patch(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        if wf is None:
            return self._fail(participants, participants_dict, "Нет хода")
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    def _fail(self, participants, participants_dict, message: str, wf: Workflow | None = None) -> SubmitResult:
        return self._rb.result(
            ok=False,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[issue("", message)],
        )
