from __future__ import annotations
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import TerrifyContext, TerrifyTarget


class TerrifySetupStage:
    key = "gumshoe.terrify.setup"

    def __init__(self, full_codex):
        self.full_codex = full_codex

    def submit(self, wf: Workflow, ctx: StageCtx, inp: dict) -> SubmitResult:
        gm_id = str(ctx.participants.gmUserId)
        if str(ctx.actor_user_id) != gm_id:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("actor", "Only GM can configure terrify")],
            )

        damage = int(inp.get("damage") or 0)
        if damage <= 0:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("damage", "Damage must be greater than 0")],
            )

        selected_ids: list[str] = inp.get("selected_ids") or []

        tc = TerrifyContext.model_validate(wf.context or {})
        tc.damage = damage

        all_chars = ctx.scene.characters or []

        if selected_ids:
            chars = [c for c in all_chars if str(c.id) in selected_ids]
        else:
            chars = list(all_chars)

        targets = []
        for c in chars:
            char_data = (c.data or {}) if isinstance(c.data, dict) else c.data.model_dump(mode="json") if c.data else {}
            skills = char_data.get("skills") or {}
            sanity_pts = int(skills.get("sanity") or skills.get("composure") or 0)

            uid = ctx.links.characterToUserId.get(c.id)

            targets.append(TerrifyTarget(
                characterId=c.id,
                userId=uid,
                name=str(c.name or ""),
                sanity_points=sanity_pts,
            ))

        tc.targets = targets
        wf.context = tc.model_dump(mode="json")
        wf.stageKey = "gumshoe.terrify.roll"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
