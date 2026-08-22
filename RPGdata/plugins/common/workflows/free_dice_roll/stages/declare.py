from __future__ import annotations

from typing import Any

import re

from app.services.roll_service import RollSpec
from plugins.common.protocols import StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from .roll import FreeDiceRollStage
from ..types import FreeDiceContext

_DICE_RE = re.compile(r"^\s*(\d+)\s*d\s*(\d+)\s*$", re.IGNORECASE)

_DECLARE_KEY = "common.free_dice_roll.declare"


def _load_ctx(wf: Workflow) -> FreeDiceContext:
    return FreeDiceContext.model_validate(wf.context or {})


def _save_ctx(wf: Workflow, ctx: FreeDiceContext) -> None:
    wf.context = ctx.model_dump(mode="json")


def _can_edit(ctx: StageCtx, fc: FreeDiceContext) -> bool:
    return str(ctx.actor_user_id) == str(fc.actor_user_id)


def _validate_expression(expr: str) -> str | None:
    raw = (expr or "").strip()
    if not raw:
        return "Укажите формулу кубов (например 1d6 или 2d6)"
    m = _DICE_RE.match(raw)
    if not m:
        return "Неверный формат: используйте NdM (например 1d6, 3d8)"
    count, sides = int(m.group(1)), int(m.group(2))
    if count < 1 or count > 100:
        return "Число кубов должно быть от 1 до 100"
    if sides < 2 or sides > 1000:
        return "Число граней должно быть от 2 до 1000"
    return None


class FreeDiceDeclareStage:
    key = _DECLARE_KEY

    def __init__(self, full_codex) -> None:
        self.full_codex = full_codex

    def patch(self, wf: Workflow, ctx: StageCtx, inp: dict[str, Any]) -> SubmitResult:
        fc = _load_ctx(wf)
        if not _can_edit(ctx, fc):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only initiator can edit")],
            )

        if inp.get("declaration") is not None:
            fc.declaration = str(inp.get("declaration") or "")
        if inp.get("expression") is not None:
            fc.expression = str(inp.get("expression") or "").strip() or "1d6"

        err = _validate_expression(fc.expression)
        if err and inp.get("expression") is not None:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("expression", err)],
            )

        _save_ctx(wf, fc)
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def submit(self, wf: Workflow, ctx: StageCtx, inp: dict[str, Any]) -> SubmitResult:
        fc = _load_ctx(wf)
        if not _can_edit(ctx, fc):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only initiator can submit")],
            )

        if inp.get("declaration") is not None:
            fc.declaration = str(inp.get("declaration") or "")
        if inp.get("expression") is not None:
            fc.expression = str(inp.get("expression") or "").strip() or fc.expression

        err = _validate_expression(fc.expression)
        if err:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("expression", err)],
            )

        _save_ctx(wf, fc)
        spec = RollSpec(expression=fc.expression, interpreter="generic", layout="combined")
        wf.stageData = {
            **(wf.stageData or {}),
            "rollSpec": spec.model_dump(mode="json"),
        }
        wf.stageKey = FreeDiceRollStage.key

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
