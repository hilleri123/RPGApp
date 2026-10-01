from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..logic import (
    SEED_REQUIRED,
    all_rolled,
    pending,
    resort,
    roll_for_player,
    roll_gm_group,
    roll_remaining,
    valid_seed,
)
from ..types import InitiativeContext

REVIEW_KEY = "initiative.review"


class InitiativeRollStage:
    """Стадия бросков: игроки бросают за своих персонажей, мастер — за NPC от одного seed.

    Каждый бросок идёт от seed рисования жеста: `input.roll_seed` (data-URL PNG из CanvasSeed).
    Кубы участника = 2d6 от f"{seed}:{entity_id}", поэтому один жест даёт разные кубы разным
    персонажам, но воспроизводимо.

    Ops (`input.op`):
      roll        игрок бросает за свои ещё не бросавшие персонажи (по умолчанию для игрока)
      roll_npcs   мастер бросает за всех NPC и персонажей без игрока от одного жеста
      proceed     мастер закрывает стадию: за не бросивших игроков бросает от своего жеста

    Когда бросили все, стадия сама переходит к проверке мастером.
    """

    key = "initiative.roll"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = InitiativeContext.model_validate(wf.context or {})
        except Exception:
            return self._fail(wf, ctx, "Контекст инициативы повреждён")

        actor = str(ctx.actor_user_id)
        is_gm = ctx.actor_user_id == ctx.participants.gmUserId
        op = str(input_dict.get("op") or "").strip()
        if not op:
            op = ("roll_npcs" if any(e.kind == "npc" or not e.owner_user_id for e in pending(c)) else "proceed") if is_gm else "roll"

        seed = input_dict.get("roll_seed")
        if op in ("roll", "roll_npcs") or (op == "proceed" and pending(c)):
            if not valid_seed(seed):
                return self._fail(wf, ctx, SEED_REQUIRED)
        seed = str(seed or "")

        if op == "roll":
            if not roll_for_player(c, actor, seed):
                return self._fail(wf, ctx, "Нечего бросать: у вас нет персонажа, который ещё не бросал")
        elif op == "roll_npcs":
            if not is_gm:
                return self._fail(wf, ctx, "За NPC бросает только мастер")
            if not roll_gm_group(c, seed):
                return self._fail(wf, ctx, "Все NPC уже бросили")
        elif op == "proceed":
            if not is_gm:
                return self._fail(wf, ctx, "Завершить броски может только мастер")
            roll_remaining(c, seed)
        else:
            return self._fail(wf, ctx, f"Неизвестная операция: {op}")

        wf.context = c.model_dump(mode="json")
        if all_rolled(c):
            resort(c)
            wf.context = c.model_dump(mode="json")
            wf.stageKey = REVIEW_KEY

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    @staticmethod
    def _fail(wf: Workflow, ctx: StageCtx, message: str) -> SubmitResult:
        return ctx.rb.result(
            ok=False,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[issue("", message)],
        )
