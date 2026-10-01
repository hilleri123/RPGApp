from __future__ import annotations

import logging
import uuid
from typing import Any, Iterable, Optional

from plugins.common.types import Workflow
from plugins.pbta.base.backend.types import MoveGrantResource, ResourceFactory, ResourceModifier
from plugins.pbta.base.backend.custom_moves import merge_moves_map
from plugins.pbta.base.backend.types import Move

logger = logging.getLogger(__name__)

from .types import (
    AffectedEntity,
    DamageClaim,
    DieAllocation,
    PerformMoveContext,
    PerformMoveEntry,
    ResourceDraft,
    ResourceGrant,
)


def primary_move_id(entry) -> str:
    if entry.moves:
        return str(entry.moves[0].id)
    return ""


def move_tags(move: Any) -> set[str]:
    return {str(t) for t in (getattr(move, "tags", None) or [])}


def move_has_tag(move: Any, tag: str) -> bool:
    return tag in move_tags(move)


def selected_moves(moves_map: dict[str, Any], entry) -> list[Any]:
    out: list[Any] = []
    for ref in entry.moves or []:
        m = moves_map.get(ref.id)
        if m is not None:
            out.append(m)
    return out


def outcome_allows_damage(outcome: Optional[str]) -> bool:
    return outcome in ("hit_10_plus", "hit_7_9", "hit", "any", None)


def should_offer_damage_claim(c: PerformMoveContext, moves_map: dict[str, Any]) -> bool:
    """Offer HP effects stage for any move — combat, social, environmental, etc."""
    if c.entry.damage_claims:
        return True
    return bool(c.entry.moves)


def has_resource_drafts(entry: PerformMoveEntry) -> bool:
    return bool(entry.resolve.resource_drafts)


def has_damage_claims(entry: PerformMoveEntry) -> bool:
    return bool(entry.damage_claims)


def merge_session_patch(wf: Workflow, patch: dict[str, list[dict]] | None) -> dict[str, list[dict]] | None:
    """Merge a new session patch into workflow stageData (accumulates across auto-stages)."""
    if not patch:
        sd = wf.stageData if isinstance(wf.stageData, dict) else {}
        return sd.get("sessionPatch") if isinstance(sd, dict) else None

    sd = dict(wf.stageData or {})
    current = sd.get("sessionPatch")
    merged: dict[str, list] = {}
    if isinstance(current, dict):
        for key, items in current.items():
            merged[key] = list(items or [])
    for key, items in patch.items():
        merged.setdefault(key, []).extend(list(items or []))
    sd["sessionPatch"] = merged or None
    wf.stageData = sd
    return merged or None


def iter_move_grants(move: Any) -> list[MoveGrantResource]:
    """Все шаблоны выдачи ресурсов хода: grant_resources + legacy resource_mods (add)."""
    out: list[MoveGrantResource] = []
    seen: set[tuple] = set()

    def push(gr: MoveGrantResource) -> None:
        key = (gr.spec_id, gr.amount, gr.target, tuple(gr.on_tier or []))
        if key in seen:
            return
        seen.add(key)
        out.append(gr)

    for raw in getattr(move, "grant_resources", None) or []:
        if isinstance(raw, MoveGrantResource):
            push(raw)
            continue
        # На isinstance полагаться нельзя: перезагрузка плагинов пересоздаёт
        # классы, и объект из codex может оказаться экземпляром другой копии
        # MoveGrantResource. Раньше такой ход молча выдавал ноль ресурсов.
        if isinstance(raw, dict):
            data = raw
        elif hasattr(raw, "model_dump"):
            data = raw.model_dump()
        else:
            logger.warning("grant_resources: неизвестный тип %r у хода %s", type(raw), getattr(move, "id", "?"))
            continue
        try:
            push(MoveGrantResource.model_validate(data))
        except Exception:
            logger.warning("grant_resources: не разобрать %r у хода %s", data, getattr(move, "id", "?"))
            continue

    for mod in getattr(move, "resource_mods", None) or []:
        if getattr(mod, "kind", "add") != "add":
            continue
        push(MoveGrantResource.from_modifier(mod))

    return out


def collect_grant_templates(
    entry: PerformMoveEntry,
    moves_map: dict[str, Any],
    *,
    outcome: str | None = None,
) -> list[dict[str, Any]]:
    """Шаблоны для UI копирования ресурсов (resources_grant / resources_confirm)."""
    templates: list[dict[str, Any]] = []
    for move_ref in entry.moves or []:
        move = moves_map.get(move_ref.id)
        if move is None:
            continue
        for gr in iter_move_grants(move):
            if outcome is not None and not _resource_mod_matches_tier(gr, outcome):
                continue
            label = gr.description or f"{move_ref.title}: {gr.spec_id}"
            inline = gr.inline_spec.model_dump(mode="json") if gr.inline_spec else None
            templates.append({
                "spec_id": gr.spec_id,
                "amount": int(gr.amount or 1),
                "description": label,
                "filter_stats": list(gr.filter_stats or []),
                "filter_moves": list(gr.filter_moves or []),
                "filter_tags": list(gr.filter_tags or []),
                "source_move_id": move_ref.id,
                "source_move_title": move_ref.title,
                "target": gr.target,
                "inline_spec": inline,
            })
    return templates


def build_resource_drafts(
    entry: PerformMoveEntry,
    moves_map: dict[str, Any],
    outcome: str,
) -> list[ResourceDraft]:
    drafts: list[ResourceDraft] = []
    idx = 0
    for move_ref in entry.moves or []:
        move = moves_map.get(move_ref.id)
        if move is None:
            continue
        for mod_index, gr in enumerate(iter_move_grants(move)):
            if not _resource_mod_matches_tier(gr, outcome):
                continue
            target_kind, target_id = _default_resource_target(entry, gr.target)
            drafts.append(ResourceDraft(
                id=f"res_{idx}",
                move_id=move_ref.id,
                move_title=move_ref.title,
                mod_index=mod_index,
                spec_id=gr.spec_id,
                mod_kind="add",
                amount=int(gr.amount or 0),
                target_kind=target_kind,
                target_id=target_id,
                description=gr.description or "",
                filter_stats=list(gr.filter_stats or []),
                filter_moves=list(gr.filter_moves or []) or [move_ref.id],
                filter_tags=list(gr.filter_tags or []),
            ))
            idx += 1
    return drafts


def _default_resource_target(entry, target: str) -> tuple[str, str]:
    if target in ("target", "enemy"):
        if entry.target_kind == "character" and entry.target_character_id:
            return "character", str(entry.target_character_id)
        if entry.target_kind == "npc" and entry.target_npc_id:
            return "npc", str(entry.target_npc_id)
    if entry.actor_kind == "character" and entry.actor_character_id:
        return "character", str(entry.actor_character_id)
    if entry.actor_kind == "npc" and entry.actor_npc_id:
        return "npc", str(entry.actor_npc_id)
    return "none", ""


def _resource_mod_matches_tier(mod: ResourceModifier | MoveGrantResource, outcome: str) -> bool:
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
    if outcome in ("any", "") and "any" in tiers:
        return True
    if not outcome or outcome == "any":
        return "any" in tiers or not tiers
    return False


def attacks_to_damage_claims(
    attacks: list[dict[str, Any]],
    *,
    scene,
    source_move_id: str = "",
) -> list[DamageClaim]:
    claims: list[DamageClaim] = []
    for raw in attacks or []:
        if not isinstance(raw, dict):
            continue
        source_kind = str(raw.get("source_kind") or "character")
        target_kind = str(raw.get("target_kind") or "npc")
        source_id = str(raw.get("source_id") or "")
        target_id = str(raw.get("target_id") or "")
        hp_effect = str(raw.get("hp_effect") or "damage")
        if hp_effect not in ("damage", "heal"):
            hp_effect = "damage"

        if not target_id:
            continue

        if source_kind == "world":
            source_id = source_id or "world"
            source_label = str(raw.get("source_label") or "Окружение")
        else:
            if not source_id:
                continue
            source_label = _entity_label(scene, source_kind, source_id)

        formula = str(raw.get("damage_expr") or "").strip()
        if not formula:
            continue

        target_label = _entity_label(scene, target_kind, target_id)

        attack_id = str(raw.get("attack_id") or "")
        attack_name = str(raw.get("attack_name") or "")

        claim_id = str(raw.get("id") or uuid.uuid4())
        dice = [int(x) for x in (raw.get("dice") or []) if str(x).lstrip("-").isdigit()]
        flat_bonus = int(raw.get("flat_bonus") or raw.get("flatBonus") or 0)
        total_raw = int(raw.get("total_raw") or 0)
        total_final = int(raw.get("total_final") or 0)
        armor_applied = int(raw.get("armor_applied") or 0)
        rolled = bool(raw.get("rolled")) or (bool(dice) and (total_raw > 0 or total_final > 0))
        roll_seed = str(raw.get("roll_seed") or raw.get("damage_seed") or "")
        allocations_raw = raw.get("allocations") or raw.get("dice_allocations") or []
        allocations: list[DieAllocation] = []
        if isinstance(allocations_raw, list):
            for item in allocations_raw:
                if not isinstance(item, dict):
                    continue
                tk = str(item.get("target_kind") or target_kind)
                tid = str(
                    item.get("target_id")
                    or item.get("target_character_id")
                    or item.get("target_npc_id")
                    or ""
                )
                if not tid:
                    continue
                die_index = int(item.get("die_index") or 0)
                value = int(
                    item.get("value")
                    or (dice[die_index] if 0 <= die_index < len(dice) else 0)
                )
                allocations.append(
                    DieAllocation(
                        die_index=die_index,
                        value=value,
                        target_kind=tk if tk in ("character", "npc") else target_kind,  # type: ignore[arg-type]
                        target_character_id=tid if tk == "character" else None,
                        target_npc_id=tid if tk == "npc" else None,
                    )
                )

        claims.append(
            DamageClaim(
                id=claim_id,
                source_kind=source_kind,  # type: ignore[arg-type]
                source_character_id=source_id if source_kind == "character" else None,
                source_npc_id=source_id if source_kind == "npc" else None,
                source_label=source_label,
                source_move_id=str(raw.get("source_move_id") or source_move_id or raw.get("attack_id") or ""),
                source_attack_id=attack_id if source_kind == "npc" else "",
                source_attack_name=attack_name if source_kind == "npc" and attack_id else "",
                target_kind=target_kind,  # type: ignore[arg-type]
                target_character_id=target_id if target_kind == "character" else None,
                target_npc_id=target_id if target_kind == "npc" else None,
                target_label=target_label,
                formula=formula,
                preset_formula=str(raw.get("preset_formula") or formula),
                hp_effect=hp_effect,  # type: ignore[arg-type]
                tags=list(raw.get("tags") or []),
                piercing=int(raw.get("piercing") or 0),
                ignores_armor=bool(raw.get("ignore_armor") or raw.get("ignores_armor")),
                multiplier=float(raw.get("multiplier") or (0.5 if raw.get("half_damage") else 1.0)),
                half_damage=bool(raw.get("half_damage")),
                counter_move_id=str(raw.get("counter_move_id") or ""),
                counter_move_title=str(raw.get("counter_move_title") or ""),
                roller_user_id=str(raw.get("roller_user_id") or "") or None,
                roller_character_id=str(raw.get("roller_character_id") or "") or None,
                roller_label=str(raw.get("roller_label") or ""),
                roll_seed=roll_seed,
                dice=dice,
                dice_allocations=allocations,
                flat_bonus=flat_bonus,
                total_raw=total_raw or (sum(dice) + flat_bonus if dice else 0),
                armor_applied=armor_applied,
                total_final=total_final,
                needs_roll=True,
                rolled=rolled,
                applied=bool(raw.get("applied")),
                cancelled=bool(raw.get("cancelled")),
                cancel_reason=str(raw.get("cancel_reason") or ""),
            )
        )
    return claims


def _entity_label(scene, kind: str, entity_id: str) -> str:
    pool = scene.characters if kind == "character" else scene.npcs
    for item in pool or []:
        if str(item.id) == str(entity_id):
            return str(getattr(item, "name", "") or entity_id)
    return entity_id


def _resource_spec_map() -> dict[str, dict[str, str]]:
    from ...codex.resources import DwResourcesCodex

    specs = DwResourcesCodex().get_resource_specs()
    return {
        str(s.id): {
            "kind": str(getattr(s, "kind", "") or ""),
            "consume_on": str(getattr(s, "consume_on", "") or "manual"),
            "title": str(getattr(s, "title", "") or s.id),
        }
        for s in specs
    }


def _resource_matches_moves(
    raw: dict[str, Any],
    *,
    move_ids: Iterable[str],
    stat_id: str = "",
) -> bool:
    move_set = {str(x) for x in move_ids}
    source_move_id = str(raw.get("source_move_id") or "")
    if source_move_id and source_move_id in move_set:
        return True
    move_filters = raw.get("filter_moves") or raw.get("filters", {}).get("moves") or []
    if move_filters:
        return any(str(mid) in move_set for mid in move_filters)
    stat_filters = raw.get("filter_stats") or raw.get("filters", {}).get("stats") or []
    if stat_filters and stat_id:
        return stat_id in [str(x) for x in stat_filters]
    return False


def _is_roll_consumable_resource(spec_id: str, raw: dict[str, Any], spec_map: dict[str, dict[str, str]]) -> bool:
    meta = spec_map.get(spec_id) or {}
    if meta.get("kind") == "bonus":
        return True
    if spec_id in ("forward", "ongoing"):
        return True
    if str(raw.get("consume_on") or "") == "roll":
        return True
    return False


def _consume_on_for_bonus(spec_id: str, raw: dict[str, Any], spec_map: dict[str, dict[str, str]]) -> str:
    explicit = str(raw.get("consume_on") or "").strip()
    if explicit:
        return explicit
    meta = spec_map.get(spec_id) or {}
    if meta.get("consume_on"):
        return str(meta["consume_on"])
    return "roll" if spec_id == "forward" else "manual"


def list_consumable_bonuses(actor_data: dict[str, Any], *, stat_id: str, move_ids: Iterable[str]) -> list[dict[str, Any]]:
    state = actor_data.get("state") or {}
    bonuses: list[dict[str, Any]] = []
    spec_map = _resource_spec_map()

    for bucket_name in ("temp_bonuses", "resources"):
        for idx, raw in enumerate(state.get(bucket_name) or []):
            if not isinstance(raw, dict):
                continue
            spec_id = str(raw.get("spec_id") or "")
            amount = int(raw.get("amount") or 0)
            if amount <= 0:
                continue
            if spec_id not in ("forward", "ongoing"):
                continue
            if bucket_name == "resources" and not _is_roll_consumable_resource(spec_id, raw, spec_map):
                continue
            filters = raw.get("filter_stats") or raw.get("filters", {}).get("stats") or []
            move_filters = raw.get("filter_moves") or raw.get("filters", {}).get("moves") or []
            if filters and stat_id and stat_id not in [str(x) for x in filters]:
                continue
            if move_filters and not any(mid in [str(x) for x in move_filters] for mid in move_ids):
                continue
            meta = spec_map.get(spec_id) or {}
            matches_move = _resource_matches_moves(raw, move_ids=move_ids, stat_id=stat_id)
            bonuses.append({
                "id": str(raw.get("id") or f"{bucket_name}:{idx}"),
                "spec_id": spec_id,
                "amount": amount,
                "description": str(raw.get("description") or meta.get("title") or spec_id),
                "bucket": bucket_name,
                "consume_on": _consume_on_for_bonus(spec_id, raw, spec_map),
                "matches_move": matches_move,
                "kind": str(meta.get("kind") or ""),
            })
    return bonuses


def list_move_matched_resources(
    actor_data: dict[str, Any],
    *,
    move_ids: Iterable[str],
    stat_id: str = "",
) -> list[dict[str, Any]]:
    """Ресурсы персонажа, привязанные к выбранным ходам (hold и др.) — для подсветки в UI."""
    state = actor_data.get("state") or {}
    move_set = {str(x) for x in move_ids}
    if not move_set:
        return []

    spec_map = _resource_spec_map()
    out: list[dict[str, Any]] = []
    for bucket_name in ("temp_bonuses", "resources", "hold"):
        for idx, raw in enumerate(state.get(bucket_name) or []):
            if not isinstance(raw, dict):
                continue
            amount = int(raw.get("amount") or 0)
            if amount <= 0:
                continue
            if not _resource_matches_moves(raw, move_ids=move_set, stat_id=stat_id):
                continue
            spec_id = str(raw.get("spec_id") or "")
            meta = spec_map.get(spec_id) or {}
            out.append({
                "id": str(raw.get("id") or f"{bucket_name}:{idx}"),
                "spec_id": spec_id,
                "amount": amount,
                "description": str(raw.get("description") or meta.get("title") or spec_id),
                "bucket": bucket_name,
                "kind": str(meta.get("kind") or ""),
                "consume_on": _consume_on_for_bonus(spec_id, raw, spec_map),
            })
    return out


def merge_patches(*patches: Optional[dict[str, list[dict]]]) -> dict[str, list[dict]]:
    merged: dict[str, list[dict]] = {}
    for patch in patches:
        if not patch:
            continue
        for key, items in patch.items():
            merged.setdefault(key, []).extend(items or [])
    return merged


def actor_resource_totals(actor_data: dict[str, Any]) -> dict[str, int]:
    state = actor_data.get("state") or {}
    totals: dict[str, int] = {}
    for bucket_name in ("temp_bonuses", "resources"):
        for raw in state.get(bucket_name) or []:
            if not isinstance(raw, dict):
                continue
            spec_id = str(raw.get("spec_id") or "")
            amount = int(raw.get("amount") or 0)
            if spec_id and amount > 0:
                totals[spec_id] = totals.get(spec_id, 0) + amount
    return totals


def move_is_available(
    move: Any,
    *,
    actor_resources: dict[str, int],
    context_tags: set[str],
    active_move_ids: set[str],
) -> bool:
    cond = getattr(move, "condition", None)
    if cond is None:
        return True

    for spec_id in getattr(cond, "requires_resource", None) or []:
        if actor_resources.get(str(spec_id), 0) <= 0:
            return False

    required = [str(t) for t in (getattr(cond, "requires_context", None) or [])]
    if not required:
        kind = str(getattr(move, "kind", "") or "")
        if kind == "class" and getattr(move, "requires_roll", True):
            required = ["action"]
    if required and not any(tag in context_tags for tag in required):
        return False

    for move_id in getattr(cond, "requires_moves", None) or []:
        if str(move_id) not in active_move_ids:
            return False

    for tag in getattr(cond, "forbidden_context", None) or []:
        if str(tag) in context_tags:
            return False

    return True


def filter_moves_by_availability(
    moves: list[Any],
    *,
    actor_resources: dict[str, int],
    context_tags: set[str],
    active_move_ids: set[str] | None = None,
) -> list[Any]:
    active = active_move_ids or {str(getattr(m, "id", "")) for m in moves}
    return [
        m for m in moves
        if move_is_available(
            m,
            actor_resources=actor_resources,
            context_tags=context_tags,
            active_move_ids=active,
        )
    ]


def _bonus_entry_id(bucket_name: str, idx: int, raw: dict[str, Any]) -> str:
    return str(raw.get("id") or f"{bucket_name}:{idx}")


def consume_bonuses_patch(
    actor_data: dict[str, Any],
    bonus_ids: list[str],
    *,
    only_consume_on: str | None = "roll",
) -> dict[str, Any]:
    """Return updated actor data dict with consumed bonuses removed.

    On roll, only forward (consume_on=roll) is burned; ongoing stays.
    """
    if not bonus_ids:
        return actor_data

    data = dict(actor_data or {})
    state = dict(data.get("state") or {})
    selected = {str(x) for x in bonus_ids}

    for bucket_name in ("temp_bonuses", "resources"):
        items: list[Any] = []
        for idx, raw in enumerate(list(state.get(bucket_name) or [])):
            if not isinstance(raw, dict):
                items.append(raw)
                continue

            bid = _bonus_entry_id(bucket_name, idx, raw)
            if bid not in selected:
                items.append(raw)
                continue

            spec_id = str(raw.get("spec_id") or "")
            consume_on = str(raw.get("consume_on") or ("roll" if spec_id == "forward" else "manual"))
            # Only burn forward on roll; never auto-drop ongoing here
            if only_consume_on == "roll":
                if spec_id != "forward" and consume_on != "roll":
                    items.append(raw)
                    continue
                if spec_id == "ongoing":
                    items.append(raw)
                    continue
            elif only_consume_on and consume_on != only_consume_on:
                items.append(raw)
                continue

            # forward and other roll-consumables are removed entirely

        state[bucket_name] = items

    data["state"] = state
    return data


def consume_bonuses_session_patch(
    scene,
    *,
    actor_kind: str,
    actor_character_id,
    actor_npc_id,
    bonus_ids: list[str],
    only_consume_on: str | None = "roll",
) -> dict[str, list[dict]]:
    if actor_kind != "character" or not actor_character_id or not bonus_ids:
        return {}

    ch = next((x for x in (scene.characters or []) if str(x.id) == str(actor_character_id)), None)
    if ch is None or not isinstance(ch.data, dict):
        return {}

    updated = consume_bonuses_patch(ch.data, bonus_ids, only_consume_on=only_consume_on)
    if updated == ch.data:
        return {}

    return {"characters": [{"id": str(ch.id), "dataPatch": updated}]}


def actor_data_from_scene(c: PerformMoveContext, scene) -> dict[str, Any] | None:
    if c.entry.actor_kind != "character" or not c.entry.actor_character_id:
        return None
    ch = next(
        (x for x in (scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
        None,
    )
    if ch and isinstance(ch.data, dict):
        return ch.data
    return None


def codex_moves_map(codex, actor_data: dict[str, Any] | None = None) -> dict[str, Any]:
    base = {
        **codex.playbooks.playbook_moves_map(),
        **codex.moves.moves_map(),
    }
    return merge_moves_map(base, actor_data)


def moves_map_for_workflow(
    wf,
    codex,
    *,
    c: PerformMoveContext | None = None,
    scene=None,
) -> dict[str, Any]:
    actor_data = actor_data_from_scene(c, scene) if c is not None and scene is not None else None
    moves_map = codex_moves_map(codex, actor_data)
    for raw in (getattr(wf, "stageData", None) or {}).get("moves") or []:
        if not isinstance(raw, dict) or raw.get("kind") != "custom":
            continue
        mid = str(raw.get("id") or "")
        if not mid or mid in moves_map:
            continue
        try:
            moves_map[mid] = Move.model_validate(raw)
        except Exception:
            continue
    return moves_map


def character_factories_from_data(
    character_id: str,
    character_name: str,
    data: dict[str, Any] | None,
    *,
    spells: list[Any] | None = None,
) -> list[ResourceFactory]:
    """Character factories removed — always empty."""
    return []


def move_factories(
    entry: PerformMoveEntry,
    moves_map: dict[str, Any],
    *,
    outcome: str | None = None,
) -> list[ResourceFactory]:
    out: list[ResourceFactory] = []
    seen: set[str] = set()
    for move_ref in entry.moves or []:
        move = moves_map.get(move_ref.id)
        if move is None:
            continue
        for gr in iter_move_grants(move):
            if outcome is not None and not _resource_mod_matches_tier(gr, outcome):
                continue
            if str(gr.spec_id) not in ("forward", "ongoing"):
                continue
            factory = gr.to_factory(move_id=move_ref.id, move_title=move_ref.title)
            if factory.id in seen:
                continue
            seen.add(factory.id)
            out.append(factory)
    return out


def collect_participating_factories(
    entry: PerformMoveEntry,
    moves_map: dict[str, Any],
    scene,
    *,
    outcome: str | None = None,
    spells: list[Any] | None = None,
) -> list[dict[str, Any]]:
    """Фабрики только из хода + базовые forward/ongoing кодека."""
    factories: list[ResourceFactory] = []
    seen: set[str] = set()

    def push_many(items: list[ResourceFactory]) -> None:
        for f in items:
            if f.id in seen:
                continue
            seen.add(f.id)
            factories.append(f)

    push_many(move_factories(entry, moves_map, outcome=outcome))

    for spec_id, label, amount in (
        ("forward", "+1 вперёд", 1),
        ("ongoing", "Ongoing +1", 1),
    ):
        fid = f"codex:{spec_id}"
        if fid not in seen:
            seen.add(fid)
            factories.append(ResourceFactory(
                id=fid,
                spec_id=spec_id,
                amount=amount,
                kind="add",
                label=label,
                source="codex",
                source_id=spec_id,
                source_title="Кодекс",
            ))

    return [f.model_dump(mode="json") for f in factories]


def fo_resource_sum(actor_data: dict[str, Any] | None) -> int:
    """Sum of forward + ongoing amounts across temp_bonuses and resources."""
    state = (actor_data or {}).get("state") or {}
    total = 0
    for bucket_name in ("temp_bonuses", "resources"):
        for raw in state.get(bucket_name) or []:
            if not isinstance(raw, dict):
                continue
            if str(raw.get("spec_id") or "") not in ("forward", "ongoing"):
                continue
            total += int(raw.get("amount") or 0)
    return total


def list_fo_instances(actor_data: dict[str, Any] | None) -> list[dict[str, Any]]:
    """All forward/ongoing instances for UI (sum + tooltip)."""
    state = (actor_data or {}).get("state") or {}
    out: list[dict[str, Any]] = []
    for bucket_name in ("temp_bonuses", "resources"):
        for idx, raw in enumerate(state.get(bucket_name) or []):
            if not isinstance(raw, dict):
                continue
            spec_id = str(raw.get("spec_id") or "")
            if spec_id not in ("forward", "ongoing"):
                continue
            amount = int(raw.get("amount") or 0)
            if amount <= 0:
                continue
            out.append({
                "id": str(raw.get("id") or f"{bucket_name}:{idx}"),
                "spec_id": spec_id,
                "amount": amount,
                "description": str(raw.get("description") or spec_id),
                "bucket": bucket_name,
                "consume_on": "roll" if spec_id == "forward" else "manual",
            })
    return out


def drop_ongoing_patch(
    actor_data: dict[str, Any],
    ongoing_ids: list[str],
) -> dict[str, Any]:
    """Remove selected ongoing instances (or all if ids empty and drop_all)."""
    if not ongoing_ids:
        return actor_data
    data = dict(actor_data or {})
    state = dict(data.get("state") or {})
    selected = {str(x) for x in ongoing_ids}
    for bucket_name in ("temp_bonuses", "resources"):
        items = []
        for idx, raw in enumerate(list(state.get(bucket_name) or [])):
            if not isinstance(raw, dict):
                items.append(raw)
                continue
            bid = _bonus_entry_id(bucket_name, idx, raw)
            spec_id = str(raw.get("spec_id") or "")
            if bid in selected and spec_id == "ongoing":
                continue
            items.append(raw)
        state[bucket_name] = items
    data["state"] = state
    return data


def apply_spellcasting_prepare(
    actor_data: dict[str, Any],
    prepared: list[dict[str, Any]],
) -> dict[str, Any]:
    """Replace prepared flags/amounts from draft list of {id, prepared, amount}."""
    data = dict(actor_data or {})
    sc = dict(data.get("spellcasting") or {})
    spells = list(sc.get("spells") or [])
    by_id = {str(p.get("id")): p for p in prepared if isinstance(p, dict) and p.get("id")}
    next_spells = []
    for raw in spells:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        sid = str(item.get("id") or "")
        if sid in by_id:
            draft = by_id[sid]
            item["prepared"] = bool(draft.get("prepared"))
            if draft.get("amount") is not None:
                item["amount"] = max(1, int(draft.get("amount") or 1))
        next_spells.append(item)
    sc["spells"] = next_spells
    data["spellcasting"] = sc
    return data


def enrich_prepared_spells_for_cast(actor_data: dict[str, Any] | None, full_codex: Any) -> list[dict[str, Any]]:
    """Prepared spell entries enriched with codex title/school/description/tags for declare UI."""
    data = actor_data if isinstance(actor_data, dict) else {}
    raw_spells = list((data.get("spellcasting") or {}).get("spells") or [])
    spells_map: dict[str, Any] = {}
    try:
        spells_map = full_codex.spells.spells_map() or {}
    except Exception:
        spells_map = {}

    out: list[dict[str, Any]] = []
    for s in raw_spells:
        if not isinstance(s, dict) or not s.get("id") or not s.get("prepared"):
            continue
        spell_id = str(s.get("spell_id") or "")
        codex = spells_map.get(spell_id) if spell_id else None
        school = str(getattr(codex, "school", None) or s.get("school") or "")
        description = str(getattr(codex, "description", None) or s.get("description") or "")
        tags = list(getattr(codex, "tags", None) or s.get("tags") or [])
        level = int(
            s.get("level")
            if s.get("level") is not None
            else (getattr(codex, "level", 0) or 0)
        )
        out.append({
            "id": str(s.get("id") or ""),
            "spell_id": spell_id,
            "title": str(s.get("title") or getattr(codex, "title", None) or spell_id or ""),
            "level": level,
            "school": school,
            "description": description,
            "tags": [str(t) for t in tags],
            "prepared": True,
            "is_cantrip": school == "фокус",
            "notes": str(s.get("notes") or ""),
        })
    out.sort(key=lambda x: (0 if x.get("is_cantrip") else 1, int(x.get("level") or 0), str(x.get("title") or "")))
    return out


def default_unprepare_cast_spell(outcome: str | None) -> bool:
    """DW cast: keep prepared on 10+; auto-unprepare on 9- (7–9 / 6−)."""
    return str(outcome or "") != "hit_10_plus"


def spend_spell_entry(
    actor_data: dict[str, Any],
    entry_id: str,
    *,
    unprepare: bool = True,
    decrease_amount: bool = False,
) -> dict[str, Any]:
    data = dict(actor_data or {})
    sc = dict(data.get("spellcasting") or {})
    spells = []
    for raw in sc.get("spells") or []:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        if str(item.get("id") or "") == str(entry_id):
            if decrease_amount and int(item.get("amount") or 1) > 1:
                item["amount"] = int(item.get("amount") or 1) - 1
            elif unprepare:
                item["prepared"] = False
        spells.append(item)
    sc["spells"] = spells
    data["spellcasting"] = sc
    return data


def character_damage_die(data: dict[str, Any] | None, full_codex: Any = None) -> str:
    """Куб урона персонажа: явное значение в data, иначе куб его плейбука, иначе d6."""
    data = data if isinstance(data, dict) else {}
    derived = data.get("derived") if isinstance(data.get("derived"), dict) else {}
    explicit = derived.get("damage_die") or data.get("damage_die")
    if explicit:
        return str(explicit)
    playbook_id = data.get("playbook_id")
    if playbook_id and full_codex is not None:
        try:
            playbook = full_codex.playbooks.playbooks_map().get(playbook_id)
        except Exception:
            playbook = None
        die = getattr(playbook, "damage_die", None)
        if die:
            return str(die)
    return "d6"


def damage_quick_options(scene, full_codex: Any = None) -> list[dict[str, Any]]:
    """Быстрый доступ: кубы урона персонажей и атаки NPC."""
    options: list[dict[str, Any]] = []
    for ch in scene.characters or []:
        data = ch.data if isinstance(getattr(ch, "data", None), dict) else {}
        die = character_damage_die(data, full_codex)
        options.append({
            "kind": "character",
            "id": str(ch.id),
            "name": str(getattr(ch, "name", "") or ch.id),
            "damage_expr": die,
            "label": f"{getattr(ch, 'name', ch.id)} · {die}",
        })
        for item in (data.get("items") or getattr(ch, "items", None) or []):
            if not isinstance(item, dict):
                continue
            item_data = item.get("data") or {}
            dmg = item_data.get("damage_dice") or item_data.get("damage")
            if not dmg:
                continue
            if not item.get("equipped") and "weapon" not in (item.get("tags") or []):
                continue
            options.append({
                "kind": "character_weapon",
                "id": str(ch.id),
                "weapon_id": str(item.get("id") or ""),
                "name": str(getattr(ch, "name", "") or ch.id),
                "weapon_name": str(item.get("name") or "оружие"),
                "damage_expr": str(dmg),
                "label": f"{getattr(ch, 'name', ch.id)} · {item.get('name')} · {dmg}",
            })

    for npc in scene.npcs or []:
        for atk in npc_attack_options(npc):
            options.append({
                "kind": "npc_attack",
                "id": str(npc.id),
                "attack_id": atk["id"],
                "name": str(getattr(npc, "name", "") or npc.id),
                "attack_name": atk["name"],
                "damage_expr": atk["damage"],
                "range_tags": atk["range_tags"],
                "attack_tags": atk["attack_tags"],
                "description": atk["description"],
                "label": f"{getattr(npc, 'name', npc.id)} · {atk['name']} · {atk['damage']}",
            })
    return options


def describe_npc_attack(name: str, damage: str, range_tags: list[str], attack_tags: list[str]) -> str:
    """Короткое описание атаки NPC: «Когти — d8+2 · close, messy»."""
    tags = [str(t) for t in (list(range_tags or []) + list(attack_tags or [])) if str(t)]
    text = name or "Атака"
    if damage:
        text += f" — {damage}"
    if tags:
        text += f" · {', '.join(tags)}"
    return text


def npc_attack_options(npc: Any) -> list[dict[str, Any]]:
    """Нормализованные атаки NPC: id, name, damage, range_tags, attack_tags, description.

    Атаки без формулы урона пропускаются — бросать по ним нечего.
    """
    data = npc.data if isinstance(getattr(npc, "data", None), dict) else {}
    raw_attacks = data.get("attacks") or getattr(npc, "attacks", None) or []
    result: list[dict[str, Any]] = []
    for idx, raw in enumerate(raw_attacks):
        atk = raw.model_dump() if hasattr(raw, "model_dump") else raw
        if not isinstance(atk, dict):
            continue
        damage = str(atk.get("damage_expr") or atk.get("damage") or "").strip()
        if not damage:
            continue
        name = str(atk.get("name") or f"Атака {idx + 1}")
        range_tags = [str(t) for t in (atk.get("range_tags") or [])]
        attack_tags = [str(t) for t in (atk.get("attack_tags") or [])]
        result.append({
            "id": str(atk.get("id") or atk.get("name") or f"atk_{idx}"),
            "name": name,
            "damage": damage,
            "range_tags": range_tags,
            "attack_tags": attack_tags,
            "description": describe_npc_attack(name, damage, range_tags, attack_tags),
        })
    return result


def find_npc_attack(npc: Any, attack_id: str) -> dict[str, Any] | None:
    for atk in npc_attack_options(npc):
        if atk["id"] == str(attack_id):
            return atk
    return None
