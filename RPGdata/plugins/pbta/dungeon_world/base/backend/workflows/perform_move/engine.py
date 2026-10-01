from __future__ import annotations

import re
import random
from typing import Any

from plugins.pbta.base.backend.workflows.perform_move.types import (
    EffectRecord,
    PendingChoice,
    ChoiceOption,
)
from plugins.pbta.base.backend.workflows.perform_move.engine import expand_choice_effects

from ...types import CharacterData, NpcData, ResourceModifier, ResourceState
from .helpers import iter_move_grants
from .types import DamageClaim, ResourceDraft


_MOVE_7_9_OPTIONS: dict[str, list[tuple[str, str]]] = {
    "go_aggro": [
        ("take_damage", "Получить урон в ответ"),
        ("lose_position", "Потерять позицию"),
        ("make_noise", "Создать шум"),
    ],
    "shoot_at": [
        ("extra_ammo", "Потратить лишний патрон"),
        ("hit_witness", "Задеть случайного свидетеля"),
        ("reveal_position", "Раскрыть позицию"),
    ],
    "evade": [
        ("lose_item", "Потерять вещь"),
        ("lose_position", "Потерять позицию"),
        ("lose_time", "Потерять время"),
    ],
    "act_under_fire": [
        ("take_damage", "Получить урон"),
        ("sacrifice", "Пожертвовать чем-то важным"),
        ("new_problem", "Создать новую проблему"),
    ],
}


_DAMAGE_RE = re.compile(r"^\s*(?:(\d*)d(\d+))\s*(?:([+-])\s*(\d+))?\s*$")


def resolve_dw_move_outcome(move: Any, outcome: str) -> tuple[list[EffectRecord], list[PendingChoice], list[str]]:
    effects: list[EffectRecord] = []
    choices: list[PendingChoice] = []
    logs: list[str] = []

    common_text = getattr(move, "effect", "") or ""
    if common_text:
        logs.append(common_text)

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

    for idx, mod in enumerate(getattr(move, "resource_mods", []) or []):
        if _resource_mod_matches_tier(mod, outcome):
            effects.append(EffectRecord(
                kind="apply_resource_mod",
                payload={"resource_mod_index": idx},
                text=getattr(mod, "description", "") or f"Apply resource mod #{idx + 1}",
            ))

    # HP changes are declared in damage_claim → damage_roll wizard, not auto-applied here.

    if outcome == "hit_7_9":
        options = _MOVE_7_9_OPTIONS.get(getattr(move, "id", ""))
        if options:
            choices.append(PendingChoice(
                id=f"{move.id}_7_9",
                kind="player_choice",
                prompt="На 7–9 выбери одно:",
                choose=1,
                options=[
                    ChoiceOption(
                        id=opt_id,
                        label=label,
                        payload={"steps": [{"kind": "text", "text": label}]},
                    )
                    for opt_id, label in options
                ],
            ))

    return effects, choices, logs


def expand_dw_choice_effects(
    move: Any,
    pending: PendingChoice,
    chosen_ids: list[str],
    target_kind: str,
    target_character_id,
    target_npc_id,
) -> tuple[list[EffectRecord], list[str]]:
    effects, logs = expand_choice_effects(pending, chosen_ids)
    if logs:
        return effects, logs

    chosen = {x for x in chosen_ids}
    for option in pending.options:
        if option.id not in chosen:
            continue
        label = option.label or option.id
        logs.append(f"Выбор 7–9: {label}")

    return effects, logs


def make_dw_apply_patch(ctx, effect: EffectRecord, move: Any, entry=None) -> dict[str, list[dict]]:
    if effect.kind == "apply_resource_mod":
        return _apply_resource_mod(ctx, effect, move, entry)

    if effect.kind == "apply_damage_mod":
        return _apply_damage_mod(ctx, effect, move, entry)

    if effect.kind == "deal_damage":
        return _apply_damage(ctx, effect)

    return {}


def _apply_resource_mod(ctx, effect: EffectRecord, move: Any, entry=None) -> dict[str, list[dict]]:
    payload = effect.payload or {}
    idx = int(payload.get("resource_mod_index", -1))
    amount_override = payload.get("amount_override")
    spec_override = payload.get("spec_id")

    grants = iter_move_grants(move)
    if 0 <= idx < len(grants):
        gr = grants[idx]
        mod = ResourceModifier(
            kind=getattr(gr, "kind", "add") if hasattr(gr, "kind") else "add",
            spec_id=str(gr.spec_id),
            amount=int(amount_override if amount_override is not None else gr.amount or 0),
            target=str(getattr(gr, "target", "self") or "self"),
            filter_stats=list(getattr(gr, "filter_stats", None) or []),
            filter_moves=list(getattr(gr, "filter_moves", None) or []),
            filter_tags=list(getattr(gr, "filter_tags", None) or []),
            description=str(getattr(gr, "description", "") or ""),
        )
    else:
        mods = list(getattr(move, "resource_mods", []) or [])
        if idx < 0 or idx >= len(mods):
            if amount_override is not None and spec_override:
                mod = ResourceModifier(
                    kind="add",
                    spec_id=str(spec_override),
                    amount=int(amount_override),
                    target="self",
                )
            else:
                return {}
        else:
            mod = mods[idx]
            if amount_override is not None:
                mod = mod.model_copy(update={"amount": int(amount_override)}) if hasattr(mod, "model_copy") else mod
    target_refs = _resolve_resource_targets(ctx, mod.target, entry)
    patch: dict[str, list[dict]] = {}

    for target_kind, target_id in target_refs:
        if target_kind == "character":
            ch = next((x for x in (ctx.scene.characters or []) if str(x.id) == str(target_id)), None)
            if ch is None:
                continue

            data = CharacterData.model_validate(ch.data)
            resources = _load_resource_states(getattr(data.state, "resources", None) or [])
            _mutate_resource_list(resources, mod, move.id)
            data.state.resources = resources

            patch.setdefault("characters", []).append({
                "id": str(ch.id),
                "dataPatch": data.model_dump(mode="json"),
            })

        elif target_kind == "npc":
            npc = next((x for x in (ctx.scene.npcs or []) if str(x.id) == str(target_id)), None)
            if npc is None:
                continue

            data = NpcData.model_validate(npc.data)
            resources: list = []
            _mutate_resource_list(resources, mod, move.id)

            patch.setdefault("npcs", []).append({
                "id": str(npc.id),
                "dataPatch": data.model_dump(mode="json"),
            })

    return patch


def _apply_damage_mod(ctx, effect: EffectRecord, move: Any, entry=None) -> dict[str, list[dict]]:
    if entry is None:
        return {}

    payload = effect.payload or {}
    idx = int(payload.get("damage_mod_index", -1))
    mods = list(getattr(move, "damage_mods", []) or [])
    if idx < 0 or idx >= len(mods):
        return {}

    mod = mods[idx]
    target_kind, target_id = _resolve_damage_target(mod.target, entry)
    if target_kind == "none" or target_id is None:
        return {}

    base_die = _actor_base_damage_die(ctx, entry)
    damage_expr = _compose_damage_expr(base_die, mod.extra_dice, mod.flat_bonus, mod.set_base_die)
    if not damage_expr:
        return {}

    dmg_effect = EffectRecord(
        kind="deal_damage",
        payload={
            "target_kind": target_kind,
            "target_id": str(target_id),
            "damage_expr": damage_expr,
            "damage_seed": f"{move.id}:{target_id}:{idx}",
            "ignores_armor": bool(getattr(mod, "ignores_armor", False)),
            "piercing": int(getattr(mod, "piercing", 0) or 0),
        },
        text=getattr(mod, "description", "") or f"Deal {damage_expr}",
    )
    return _apply_damage(ctx, dmg_effect)


def _npc_current_hp(data: Any, max_hp: int) -> int:
    """Текущее HP NPC. Ноль — это ноль (мёртвый NPC), а не «поле не задано».

    Полным HP считаем только NPC, у которого `hp_current` вообще не сохранён.
    """
    fields_set = getattr(data, "model_fields_set", None)
    raw = getattr(data, "hp_current", None)
    if raw is None or (fields_set is not None and "hp_current" not in fields_set):
        return max(0, int(max_hp or 0))
    return max(0, int(raw))


def _apply_damage(ctx, effect: EffectRecord) -> dict[str, list[dict]]:
    payload = effect.payload or {}
    target_kind = payload.get("target_kind")
    target_id = payload.get("target_id")
    damage_expr = str(payload.get("damage_expr", "") or "")
    damage_seed = str(payload.get("damage_seed", "") or "")
    ignores_armor = bool(payload.get("ignores_armor", False))
    piercing = int(payload.get("piercing", 0) or 0)

    total, _, _ = _roll_damage_expr(damage_expr, damage_seed)
    armor = 0 if ignores_armor else max(0, _target_armor(ctx, target_kind, target_id) - piercing)
    final_damage = max(0, total - armor)

    if target_kind == "character":
        ch = next((x for x in (ctx.scene.characters or []) if str(x.id) == str(target_id)), None)
        if ch is None:
            return {}

        data = CharacterData.model_validate(ch.data)
        data.hp = max(0, int(data.hp) - final_damage)
        return {"characters": [{"id": str(ch.id), "dataPatch": data.model_dump(mode="json")}]}

    if target_kind == "npc":
        npc = next((x for x in (ctx.scene.npcs or []) if str(x.id) == str(target_id)), None)
        if npc is None:
            return {}

        data = NpcData.model_validate(npc.data)
        max_hp = int(getattr(data, "hp", 0) or 0)
        current_hp = _npc_current_hp(data, max_hp)
        data.hp_current = max(0, current_hp - final_damage)
        data.hp = max_hp if max_hp > 0 else data.hp_current

        tags = list(getattr(npc, "tags", []) or [])
        if data.hp_current <= 0:
            tags = list(getattr(npc, "tags", []) or [])
            if "dead" not in tags:
                tags.append("dead")

            return {
                "npcs": [{
                    "id": str(npc.id),
                    "dataPatch": data.model_dump(mode="json"),
                    "tagsPatch": tags,
                }]
            }

        return {
            "npcs": [{
                "id": str(npc.id),
                "dataPatch": data.model_dump(mode="json"),
            }]
        }

    return {}


def _mutate_resource_list(resources: list[ResourceState], mod: ResourceModifier, source_move_id: str) -> None:
    same = [r for r in resources if r.spec_id == mod.spec_id]

    if mod.kind == "clear":
        resources[:] = [r for r in resources if r.spec_id != mod.spec_id]
        return

    if mod.kind == "set":
        if same:
            same[0].amount = mod.amount
            _copy_resource_filters(same[0], mod)
            same[0].source_move_id = source_move_id
        else:
            resources.append(_resource_state_from_mod(mod, source_move_id, mod.amount))
        return

    if mod.kind == "add":
        if same:
            same[0].amount += mod.amount
            _copy_resource_filters(same[0], mod)
            same[0].source_move_id = source_move_id
        else:
            resources.append(_resource_state_from_mod(mod, source_move_id, mod.amount))
        return

    if mod.kind == "remove":
        if same:
            same[0].amount = max(0, same[0].amount - mod.amount)
            if same[0].amount == 0:
                resources[:] = [r for r in resources if r is not same[0]]
        return


def _resource_state_from_mod(mod: ResourceModifier, source_move_id: str, amount: int) -> ResourceState:
    return ResourceState(
        spec_id=mod.spec_id,
        amount=amount,
        source_move_id=source_move_id,
        filter_stats=list(mod.filter_stats or []),
        filter_moves=list(mod.filter_moves or []),
        filter_tags=list(mod.filter_tags or []),
        description=mod.description or "",
    )


def _copy_resource_filters(state: ResourceState, mod: ResourceModifier) -> None:
    state.filter_stats = list(mod.filter_stats or [])
    state.filter_moves = list(mod.filter_moves or [])
    state.filter_tags = list(mod.filter_tags or [])
    state.description = mod.description or state.description


def _resolve_resource_targets(ctx, target: str, entry) -> list[tuple[str, str]]:
    if entry is None:
        return []

    if target == "self" and entry.actor_kind == "character" and entry.actor_character_id:
        return [("character", str(entry.actor_character_id))]
    if target == "self" and entry.actor_kind == "npc" and entry.actor_npc_id:
        return [("npc", str(entry.actor_npc_id))]

    if target in ("target", "enemy"):
        if entry.target_kind == "character" and entry.target_character_id:
            return [("character", str(entry.target_character_id))]
        if entry.target_kind == "npc" and entry.target_npc_id:
            return [("npc", str(entry.target_npc_id))]

    return []


def _resolve_damage_target(target: str, entry) -> tuple[str, str | None]:
    if entry is None:
        return "none", None

    if target in ("target", "enemy"):
        if entry.target_kind == "character" and entry.target_character_id:
            return "character", str(entry.target_character_id)
        if entry.target_kind == "npc" and entry.target_npc_id:
            return "npc", str(entry.target_npc_id)

    if target == "self":
        if entry.actor_kind == "character" and entry.actor_character_id:
            return "character", str(entry.actor_character_id)
        if entry.actor_kind == "npc" and entry.actor_npc_id:
            return "npc", str(entry.actor_npc_id)

    return "none", None


def _actor_base_damage_die(ctx, entry) -> str:
    if entry.actor_kind == "character" and entry.actor_character_id:
        ch = next((x for x in (ctx.scene.characters or []) if x.id == entry.actor_character_id), None)
        if ch and isinstance(ch.data, dict):
            playbook_id = ch.data.get("playbook_id", "")
            playbook = ctx.rb.full_codex.playbooks.playbooks_map().get(playbook_id) if hasattr(ctx.rb, "full_codex") else None
            if playbook:
                return str(getattr(playbook, "damage_die", "d6") or "d6")
    return "d6"


def _compose_damage_expr(base_die: str, extra_dice: list[str], flat_bonus: int, set_base_die: str | None) -> str:
    dice_parts: list[str] = []
    primary = set_base_die or base_die
    if primary:
        dice_parts.append(primary)
    for d in extra_dice or []:
        dice_parts.append(d)

    if not dice_parts and flat_bonus == 0:
        return ""

    if not dice_parts:
        return str(flat_bonus)

    expr = " + ".join(dice_parts)
    if flat_bonus > 0:
        expr += f" + {flat_bonus}"
    elif flat_bonus < 0:
        expr += f" - {abs(flat_bonus)}"
    return expr


def _target_armor(ctx, target_kind: str, target_id: str) -> int:
    if target_kind == "npc":
        npc = next((x for x in (ctx.scene.npcs or []) if str(x.id) == str(target_id)), None)
        if npc is None:
            return 0
        data = NpcData.model_validate(npc.data)
        return max(0, int(getattr(data, "armor", 0) or 0))

    if target_kind == "character":
        ch = next((x for x in (ctx.scene.characters or []) if str(x.id) == str(target_id)), None)
        if ch is None:
            return 0
        data = CharacterData.model_validate(ch.data)
        return max(0, int(getattr(data, "armor_cache", 0) or 0))

    return 0


def _roll_damage_expr(expr: str, seed: str) -> tuple[int, list[int], int]:
    parts = [p.strip() for p in expr.split("+")]
    rng = random.Random(seed)

    total = 0
    rolls: list[int] = []
    modifier = 0

    for part in parts:
        part = part.strip()
        if not part:
            continue

        if "d" in part:
            m = _DAMAGE_RE.match(part)
            if not m:
                raise ValueError(f"Invalid damage expression part: {part}")

            count_raw, die_raw, sign, mod_raw = m.groups()
            count = int(count_raw or 1)
            die = int(die_raw)
            local_mod = int(mod_raw or 0)
            if sign == "-":
                local_mod = -local_mod

            local_rolls = [rng.randint(1, die) for _ in range(count)]
            rolls.extend(local_rolls)
            total += sum(local_rolls) + local_mod
            modifier += local_mod
        else:
            value = int(part)
            total += value
            modifier += value

    return total, rolls, modifier


def _resource_mod_matches_tier(mod: ResourceModifier, outcome: str) -> bool:
    tiers = list(mod.on_tier or [])
    if not tiers:
        return True
    if outcome == "hit_10_plus" and "10_plus" in tiers:
        return True
    if outcome == "hit_7_9" and "7_9" in tiers:
        return True
    if outcome == "miss_6_minus" and "6_minus" in tiers:
        return True
    if outcome in ("hit_10_plus", "hit_7_9") and "any_hit" in tiers:
        return True
    if "any" in tiers:
        return True
    return False


def _damage_mod_matches_tier(mod, outcome: str) -> bool:
    tiers = list(getattr(mod, "on_tier", []) or [])
    if not tiers:
        return True
    if outcome == "hit_10_plus" and "10_plus" in tiers:
        return True
    if outcome == "hit_7_9" and "7_9" in tiers:
        return True
    if outcome == "miss_6_minus" and "6_minus" in tiers:
        return True
    if outcome in ("hit_10_plus", "hit_7_9") and "any_hit" in tiers:
        return True
    if "any" in tiers:
        return True
    return False


def roll_damage_claim(claim: DamageClaim, scene, *, seed: str | None = None) -> None:
    # Already fully resolved.
    if claim.rolled and int(claim.total_raw or 0) > 0 and int(claim.total_final or 0) > 0:
        return

    if not (claim.rolled and claim.dice and int(claim.total_raw or 0) > 0):
        roll_seed = seed or claim.roll_seed or claim.id
        total, dice, flat = _roll_damage_expr(claim.formula, roll_seed)
        claim.roll_seed = roll_seed
        claim.dice = dice
        claim.flat_bonus = flat
        claim.total_raw = total
        claim.rolled = True

    if claim.hp_effect == "heal":
        claim.armor_applied = 0
        claim.total_final = max(0, int(claim.total_raw or 0))
        return

    armor = 0
    target_kind = claim.target_kind
    target_id = claim.target_character_id if target_kind == "character" else claim.target_npc_id
    if target_id:

        class _Ctx:
            def __init__(self, s):
                self.scene = s

        armor = _target_armor(_Ctx(scene), target_kind, str(target_id))

    effective_armor = 0 if claim.ignores_armor else max(0, armor - int(claim.piercing or 0))
    multiplier = 0.5 if claim.half_damage else float(claim.multiplier or 1.0)
    claim.armor_applied = effective_armor
    raw_after_armor = max(0, int(claim.total_raw or 0) - effective_armor)
    claim.total_final = max(0, int(raw_after_armor * multiplier))


def build_damage_hp_patch(ctx, claim: DamageClaim) -> dict[str, list[dict]]:
    return build_damage_hp_patches(ctx, claim)


def build_damage_hp_patches(ctx, claim: DamageClaim) -> dict[str, list[dict]]:
    if claim.cancelled:
        return {}

    is_heal = claim.hp_effect == "heal"

    if claim.dice_allocations:
        multiplier = 1.0 if is_heal else (0.5 if claim.half_damage else float(claim.multiplier or 1.0))
        by_target: dict[tuple[str, str], int] = {}
        for alloc in claim.dice_allocations:
            target_id = (
                alloc.target_character_id
                if alloc.target_kind == "character"
                else alloc.target_npc_id
            )
            if not target_id:
                continue
            key = (alloc.target_kind, str(target_id))
            by_target[key] = by_target.get(key, 0) + int(alloc.value or 0)

        flat = int(claim.flat_bonus or 0)
        if flat:
            default_id = (
                claim.target_character_id
                if claim.target_kind == "character"
                else claim.target_npc_id
            )
            if default_id:
                key = (claim.target_kind, str(default_id))
                by_target[key] = by_target.get(key, 0) + flat

        patch: dict[str, list[dict]] = {}
        for (target_kind, target_id), raw_total in by_target.items():
            if is_heal:
                final_amount = max(0, int(raw_total * multiplier))
                if final_amount <= 0:
                    continue
                sub_patch = _apply_fixed_heal(ctx, target_kind, target_id, final_amount)
            else:
                armor = 0 if claim.ignores_armor else max(
                    0,
                    _target_armor(ctx, target_kind, target_id) - int(claim.piercing or 0),
                )
                raw_after_armor = max(0, raw_total - armor)
                final_damage = max(0, int(raw_after_armor * multiplier))
                if final_damage <= 0:
                    continue
                sub_patch = _apply_fixed_damage(
                    ctx,
                    type("Eff", (), {
                        "payload": {
                            "target_kind": target_kind,
                            "target_id": target_id,
                            "fixed_damage": final_damage,
                        },
                    })(),
                )
            for key, items in sub_patch.items():
                patch.setdefault(key, []).extend(items)
        return patch

    if claim.total_final <= 0:
        return {}

    if is_heal:
        target_id = str(
            claim.target_character_id if claim.target_kind == "character" else claim.target_npc_id
        )
        return _apply_fixed_heal(ctx, claim.target_kind, target_id, claim.total_final)

    effect = type("Eff", (), {
        "kind": "deal_damage",
        "payload": {
            "target_kind": claim.target_kind,
            "target_id": str(
                claim.target_character_id if claim.target_kind == "character" else claim.target_npc_id
            ),
            "fixed_damage": claim.total_final,
        },
    })()
    return _apply_fixed_damage(ctx, effect)


def _apply_fixed_heal(ctx, target_kind: str, target_id: str, heal_amount: int) -> dict[str, list[dict]]:
    amount = int(heal_amount or 0)
    if amount <= 0:
        return {}

    if target_kind == "character":
        ch = next((x for x in (ctx.scene.characters or []) if str(x.id) == str(target_id)), None)
        if ch is None:
            return {}
        data = CharacterData.model_validate(ch.data)
        current = int(getattr(data, "hp", 0) or 0)
        max_hp = int(getattr(data, "max_hp", 0) or 0)
        data.hp = min(max_hp, current + amount) if max_hp > 0 else current + amount
        return {"characters": [{"id": str(ch.id), "dataPatch": data.model_dump(mode="json")}]}

    if target_kind == "npc":
        npc = next((x for x in (ctx.scene.npcs or []) if str(x.id) == str(target_id)), None)
        if npc is None:
            return {}
        data = NpcData.model_validate(npc.data)
        max_hp = int(getattr(data, "hp", 0) or 0)
        current = _npc_current_hp(data, max_hp)
        data.hp_current = min(max_hp, current + amount) if max_hp > 0 else current + amount
        data.hp = max_hp or data.hp_current
        patch: dict[str, Any] = {"id": str(npc.id), "dataPatch": data.model_dump(mode="json")}
        tags = list(getattr(npc, "tags", []) or [])
        if data.hp_current > 0 and "dead" in tags:
            tags = [t for t in tags if t != "dead"]
            patch["tagsPatch"] = tags
        return {"npcs": [patch]}

    return {}


def _apply_fixed_damage(ctx, effect) -> dict[str, list[dict]]:
    payload = effect.payload or {}
    target_kind = payload.get("target_kind")
    target_id = payload.get("target_id")
    final_damage = int(payload.get("fixed_damage", 0) or 0)
    if final_damage <= 0:
        return {}

    if target_kind == "character":
        ch = next((x for x in (ctx.scene.characters or []) if str(x.id) == str(target_id)), None)
        if ch is None:
            return {}
        data = CharacterData.model_validate(ch.data)
        data.hp = max(0, int(data.hp) - final_damage)
        return {"characters": [{"id": str(ch.id), "dataPatch": data.model_dump(mode="json")}]}

    if target_kind == "npc":
        npc = next((x for x in (ctx.scene.npcs or []) if str(x.id) == str(target_id)), None)
        if npc is None:
            return {}
        data = NpcData.model_validate(npc.data)
        max_hp = int(getattr(data, "hp", 0) or 0)
        current_hp = _npc_current_hp(data, max_hp)
        data.hp_current = max(0, current_hp - final_damage)
        # Keep max HP intact — only current HP changes.
        data.hp = max_hp if max_hp > 0 else data.hp_current
        patch: dict[str, Any] = {"id": str(npc.id), "dataPatch": data.model_dump(mode="json")}
        if data.hp_current <= 0:
            tags = list(getattr(npc, "tags", []) or [])
            if "dead" not in tags:
                tags.append("dead")
            patch["tagsPatch"] = tags
        return {"npcs": [patch]}

    return {}


def apply_resource_draft(ctx, draft: ResourceDraft, moves_map: dict) -> dict[str, list[dict]]:
    if not draft.spec_id or not draft.target_id:
        return {}

    mod = ResourceModifier(
        kind=draft.mod_kind or "add",
        spec_id=draft.spec_id,
        amount=int(draft.amount or 0),
        target="self",
        filter_stats=list(draft.filter_stats or []),
        filter_moves=list(draft.filter_moves or []),
        filter_tags=list(draft.filter_tags or []),
        description=draft.description or "",
    )
    move_id = draft.move_id or "draft"
    patch: dict[str, list[dict]] = {}

    if draft.target_kind == "character":
        ch = next((x for x in (ctx.scene.characters or []) if str(x.id) == str(draft.target_id)), None)
        if ch is None:
            return {}
        data = CharacterData.model_validate(ch.data)
        resources = _load_resource_states(getattr(data.state, "resources", None) or [])
        _mutate_resource_list(resources, mod, move_id)
        if draft.filter_moves:
            for r in resources:
                if r.spec_id == mod.spec_id:
                    r.filter_moves = list(draft.filter_moves or [])
                    r.source_move_id = move_id
        data.state.resources = resources
        patch["characters"] = [{"id": str(ch.id), "dataPatch": data.model_dump(mode="json")}]
        return patch

    if draft.target_kind == "npc":
        npc = next((x for x in (ctx.scene.npcs or []) if str(x.id) == str(draft.target_id)), None)
        if npc is None:
            return {}
        data = NpcData.model_validate(npc.data)
        resources = _load_resource_states(getattr(data, "resources", None) or [])
        _mutate_resource_list(resources, mod, move_id)
        data.resources = resources
        patch["npcs"] = [{"id": str(npc.id), "dataPatch": data.model_dump(mode="json")}]
        return patch

    return {}


def _load_resource_states(raw_list) -> list[ResourceState]:
    out: list[ResourceState] = []
    for raw in raw_list or []:
        if isinstance(raw, ResourceState):
            out.append(raw)
        elif hasattr(raw, "model_dump"):
            dumped = raw.model_dump(mode="json")
            if dumped.get("description") is None:
                dumped["description"] = ""
            out.append(ResourceState.model_validate(dumped))
        elif isinstance(raw, dict):
            out.append(ResourceState.model_validate(raw))
    return out