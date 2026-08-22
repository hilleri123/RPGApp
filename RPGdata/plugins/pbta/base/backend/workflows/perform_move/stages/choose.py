from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..engine import expand_choice_effects
from ..types import PerformMoveContext


class ChoiceResolveItem(BaseModel):
    choice_id: str
    option_ids: list[str] = Field(default_factory=list)


class ChooseInput(BaseModel):
    choices: list[ChoiceResolveItem] = Field(default_factory=list)


class PerformMoveChooseStage(BaseStage):
    key = "perform_move.choose"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
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

        parsed = ctx.rb.parse_input(ChooseInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        by_id = {x.id: x for x in c.entry.pending_choices}

        for item in parsed.choices:
            pending = by_id.get(item.choice_id)
            if pending is None:
                return err("choices", f"Unknown choice id: {item.choice_id}")

            limit = max(1, int(pending.choose or 1))
            if len(item.option_ids) != limit:
                return err("choices", f"Choice '{item.choice_id}' requires exactly {limit} option(s)")

            allowed_ids = {opt.id for opt in pending.options}
            if any(opt_id not in allowed_ids for opt_id in item.option_ids):
                return err("choices", f"Choice '{item.choice_id}' contains invalid option ids")

            pending.resolved_option_ids = list(item.option_ids)
            pending.resolved = True

            effects, logs = expand_choice_effects(pending, item.option_ids)
            c.entry.effects.extend(effects)
            c.entry.log_lines.extend(logs)

        unresolved = [x for x in c.entry.pending_choices if not x.resolved]
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "perform_move.choose" if unresolved else "perform_move.apply"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )