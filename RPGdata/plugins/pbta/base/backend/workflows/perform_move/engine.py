from __future__ import annotations

from typing import Any
from uuid import UUID

from .types import ChoiceOption, EffectRecord, PendingChoice


def resolve_move_outcome(move: Any, outcome: str) -> tuple[list[EffectRecord], list[PendingChoice], list[str]]:
    """
    Базовый PbtA fallback-resolver.

    Он не знает про конкретную игру.
    Он просто:
    - превращает текстовые outcome-поля в log_lines;
    - если у move есть новая структурная схема outcomes/steps, пытается
      использовать её через очень маленький базовый интерпретатор.
    """
    effects: list[EffectRecord] = []
    choices: list[PendingChoice] = []
    logs: list[str] = []

    structured_outcomes = getattr(move, "outcomes", None) or []
    if structured_outcomes:
        for oc in structured_outcomes:
            on = getattr(oc, "on", None)
            if not _matches_outcome(on, outcome):
                continue

            for step in getattr(oc, "steps", []) or []:
                step_kind = getattr(step, "kind", "")

                if step_kind == "text":
                    text = getattr(step, "text", "") or ""
                    if text:
                        logs.append(text)

                elif step_kind == "choice":
                    options = []
                    for opt in getattr(step, "options", []) or []:
                        option_id = getattr(opt, "id", "")
                        label = getattr(opt, "label", "") or option_id
                        payload = {"steps": _dump_steps(getattr(opt, "steps", []) or [])}
                        options.append(ChoiceOption(id=option_id, label=label, payload=payload))

                    choices.append(PendingChoice(
                        id=f"choice:{len(choices)}",
                        kind="player_choice",
                        prompt=getattr(step, "prompt", "") or "Choose option",
                        choose=int(getattr(step, "choose", 1) or 1),
                        options=options,
                    ))

                elif step_kind == "ask_question":
                    questions = []
                    for i, q in enumerate(getattr(step, "questions", []) or []):
                        questions.append(ChoiceOption(
                            id=f"q:{i}",
                            label=str(q),
                            payload={"question": str(q)},
                        ))

                    choices.append(PendingChoice(
                        id=f"question:{len(choices)}",
                        kind="question_list",
                        prompt=getattr(step, "prompt", "") or "Choose question(s)",
                        choose=int(getattr(step, "choose", 1) or 1),
                        options=questions,
                    ))

                elif step_kind == "grant_bonus":
                    effects.append(EffectRecord(
                        kind="grant_bonus",
                        payload={"bonus": _model_dump(getattr(step, "bonus", None))},
                        text="Grant temporary bonus",
                    ))

                elif step_kind == "gm_directive":
                    text = getattr(step, "text", "") or ""
                    effects.append(EffectRecord(
                        kind="gm_directive",
                        payload={"text": text},
                        text=text,
                    ))

                elif step_kind == "hold":
                    effects.append(EffectRecord(
                        kind="grant_resource",
                        payload={
                            "resource_id": getattr(step, "resource_id", ""),
                            "amount": int(getattr(step, "amount", 0) or 0),
                        },
                        text="Grant hold/resource",
                    ))

                else:
                    effects.append(EffectRecord(
                        kind=f"unhandled:{step_kind}",
                        payload=_model_dump(step),
                        text=f"Unhandled step kind: {step_kind}",
                    ))

        return effects, choices, logs

    if outcome == "hit_10_plus":
        text = getattr(move, "effect_10_plus", "") or ""
        if text:
            logs.append(text)
    elif outcome == "hit_7_9":
        text = getattr(move, "effect_7_9", "") or ""
        if text:
            logs.append(text)
    elif outcome == "miss_6_minus":
        text = getattr(move, "effect_6_minus", "") or ""
        if text:
            logs.append(text)

    common_text = getattr(move, "effect", "") or ""
    if common_text and common_text not in logs:
        logs.insert(0, common_text)

    return effects, choices, logs


def expand_choice_effects(pending: PendingChoice, chosen_ids: list[str]) -> tuple[list[EffectRecord], list[str]]:
    effects: list[EffectRecord] = []
    logs: list[str] = []

    chosen = {x for x in chosen_ids}
    for option in pending.options:
        if option.id not in chosen:
            continue

        payload_steps = option.payload.get("steps", [])
        for raw in payload_steps:
            kind = raw.get("kind", "")
            if kind == "text":
                text = raw.get("text", "")
                if text:
                    logs.append(text)
            else:
                effects.append(EffectRecord(
                    kind=kind,
                    payload=raw,
                    text=raw.get("text", "") or raw.get("description", ""),
                ))

    return effects, logs


def make_apply_patch(scene, effect: EffectRecord) -> dict[str, list[dict]]:
    """
    Базовый apply ничего не знает о конкретной игре.
    Поэтому:
    - gm_directive только логический;
    - grant_bonus/resource пока не меняет session state;
    - игра может override-ить apply и реально патчить персонажей/NPC.
    """
    return {}


def _matches_outcome(on: Any, outcome: str) -> bool:
    if on in (None, "", "any"):
        return True
    if on == outcome:
        return True
    if on == "hit" and outcome in ("hit_10_plus", "hit_7_9"):
        return True
    return False


def _model_dump(x: Any) -> dict[str, Any]:
    if x is None:
        return {}
    if hasattr(x, "model_dump"):
        return x.model_dump(mode="json")
    if isinstance(x, dict):
        return x
    return {"value": x}


def _dump_steps(steps: list[Any]) -> list[dict[str, Any]]:
    dumped: list[dict[str, Any]] = []
    for step in steps:
        dumped.append(_model_dump(step))
    return dumped