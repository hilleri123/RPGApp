from __future__ import annotations
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import TerrifyContext
from ....types import CharacterData


class TerrifyResultStage:
    key = "gumshoe.terrify.result"

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
                issues=[issue("actor", "Only GM can finalize terrify")],
            )

        tc = TerrifyContext.model_validate(wf.context or {})
        scene = ctx.scene
        patch: dict[str, list[dict]] = {}

        for target in tc.targets:
            if not target.passed and target.stability_loss > 0:
                char_obj = next(
                    (c for c in (scene.characters or []) if str(c.id) == target.characterId),
                    None,
                )
                if char_obj:
                    char_data = CharacterData.model_validate(char_obj.data)
                    current = int(char_data.stability or 0)
                    char_data.stability = max(0, current - target.stability_loss)
                    patch.setdefault("characters", []).append({
                        "id": str(char_obj.id),
                        "dataPatch": char_data.model_dump(mode="json"),
                    })

        wf.status = "completed"
        wf.stageKey = "completed"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=patch or None,
        )
