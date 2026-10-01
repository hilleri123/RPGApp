"""Бросок и правка порядка инициативы. Чистые функции над контекстом workflow."""

from __future__ import annotations

from typing import Any, Optional

from app.services.roll_persist import seed_hash_of, store_seed_image
from plugins.common.dice import roll_2d6
from plugins.common.types import SceneContext

from ...initiative import dex_modifier, sort_key
from .types import InitEntry, InitiativeContext


def scene_participants(scene: SceneContext, owners: dict[str, str]) -> dict[str, dict[str, Any]]:
    """Все, кто может встать в очередь: персонажи и NPC сцены, id -> описание."""
    out: dict[str, dict[str, Any]] = {}
    for ch in scene.characters or []:
        out[str(ch.id)] = {
            "kind": "character",
            "name": getattr(ch, "name", "") or "",
            "data": ch.data if isinstance(ch.data, dict) else {},
            "owner_user_id": owners.get(str(ch.id)),
        }
    for npc in scene.npcs or []:
        out[str(npc.id)] = {
            "kind": "npc",
            "name": getattr(npc, "name", "") or "",
            "data": npc.data if isinstance(npc.data, dict) else {},
            "owner_user_id": None,
        }
    return out


def owners_map(links: Any) -> dict[str, str]:
    raw = getattr(links, "characterToUserId", None) or {}
    return {str(k): str(v) for k, v in raw.items()}


MIN_SEED_LEN = 64
SEED_REQUIRED = "Нарисуйте жест: каждый бросок идёт от seed рисования"


def valid_seed(seed: Any) -> bool:
    """Seed броска — рисунок жеста (data-URL PNG). Короткие/пустые значения не принимаем."""
    return isinstance(seed, str) and len(seed) >= MIN_SEED_LEN


def _seed_meta(seed: str) -> tuple[str, Optional[str]]:
    """(хэш жеста, путь к сохранённому рисунку). Рисунок нужен только для просмотра."""
    try:
        h, ref = store_seed_image(seed)
    except Exception:
        h, ref = None, None
    return h or seed_hash_of(seed) or "", ref


def roll_entry(entity_id: str, info: dict[str, Any], seed: str) -> InitEntry:
    """Бросок 2d6 + ЛОВ от seed жеста; кубы участника = roll_2d6(f"{seed}:{entity_id}")."""
    dice, rolled = roll_2d6(f"{seed}:{entity_id}")
    mod = dex_modifier(info.get("data"))
    seed_hash, seed_ref = _seed_meta(seed)
    return InitEntry(
        entity_id=entity_id,
        kind=info["kind"],
        name=info.get("name", ""),
        owner_user_id=info.get("owner_user_id"),
        modifier=mod,
        dice=list(dice),
        roll_seed=seed_hash,
        seed_image_ref=seed_ref,
        total=int(rolled) + mod,
    )


def build_pending(scene: SceneContext, owners: dict[str, str]) -> InitiativeContext:
    """Стадия бросков: все участники в списке, но кубы ещё никто не бросил."""
    entries = [
        InitEntry(
            entity_id=eid,
            kind=info["kind"],
            name=info.get("name", ""),
            owner_user_id=info.get("owner_user_id"),
            modifier=dex_modifier(info.get("data")),
            rolled=False,
        )
        for eid, info in scene_participants(scene, owners).items()
    ]
    return InitiativeContext(scene_id=str(scene.id), entries=entries)


def _apply_roll(entry: InitEntry, seed: str) -> None:
    dice, rolled = roll_2d6(f"{seed}:{entry.entity_id}")
    entry.dice = list(dice)
    entry.roll_seed, entry.seed_image_ref = _seed_meta(seed)
    entry.total = int(rolled) + entry.modifier
    entry.rolled = True
    entry.manual = False


def pending(ctx: InitiativeContext) -> list[InitEntry]:
    return [e for e in ctx.entries if not e.rolled]


def all_rolled(ctx: InitiativeContext) -> bool:
    return bool(ctx.entries) and not pending(ctx)


def roll_for_player(ctx: InitiativeContext, user_id: str, seed: str) -> int:
    """Игрок бросает за свои персонажи от своего жеста. Возвращает число бросков."""
    count = 0
    for entry in pending(ctx):
        if entry.kind == "character" and entry.owner_user_id == user_id:
            _apply_roll(entry, seed)
            count += 1
    return count


def roll_gm_group(ctx: InitiativeContext, seed: str) -> int:
    """Мастер бросает за всех NPC и персонажей без игрока от одного жеста."""
    targets = [e for e in pending(ctx) if e.kind == "npc" or not e.owner_user_id]
    if not targets:
        return 0
    ctx.npc_seed = seed_hash_of(seed) or ""
    for entry in targets:
        _apply_roll(entry, seed)
    return len(targets)


def roll_remaining(ctx: InitiativeContext, seed: str) -> int:
    """Мастер закрывает стадию: за не бросивших игроков бросает от жеста мастера."""
    count = roll_gm_group(ctx, seed)
    for entry in pending(ctx):
        _apply_roll(entry, seed)
        count += 1
    return count


def resort(ctx: InitiativeContext) -> None:
    ctx.entries.sort(key=lambda e: sort_key(e.kind, e.name, e.total, e.entity_id))


def candidates(ctx: InitiativeContext, participants: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Кого ещё можно добавить в очередь (есть в сцене, но нет в порядке)."""
    taken = {e.entity_id for e in ctx.entries}
    return [
        {"id": eid, "kind": info["kind"], "name": info["name"], "modifier": dex_modifier(info.get("data"))}
        for eid, info in participants.items()
        if eid not in taken
    ]


def _str_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(x) for x in raw if x]


def apply_edit(
    ctx: InitiativeContext,
    participants: dict[str, dict[str, Any]],
    edit: dict[str, Any],
) -> Optional[str]:
    """Применяет правку мастера. Возвращает текст ошибки или None.

    Поддерживаются (в таком порядке применения):
      remove: [id]          убрать из очереди
      add: [id]             добавить из сцены и бросить кубы (нужен roll_seed — жест)
      reroll: [id]          перебросить (нужен roll_seed — жест)
      values: {id: int}     задать итог вручную
      order: [id]           расставить порядок вручную (id, которых нет в списке, отбрасываются)
    """
    by_id = {e.entity_id: e for e in ctx.entries}

    seed = edit.get("roll_seed")
    if (_str_list(edit.get("add")) or _str_list(edit.get("reroll"))) and not valid_seed(seed):
        return SEED_REQUIRED

    for eid in _str_list(edit.get("remove")):
        by_id.pop(eid, None)

    for eid in _str_list(edit.get("add")):
        if eid in by_id:
            continue
        info = participants.get(eid)
        if info is None:
            return f"Участника {eid} нет в сцене"
        by_id[eid] = roll_entry(eid, info, seed)

    for eid in _str_list(edit.get("reroll")):
        entry = by_id.get(eid)
        if entry is None:
            return f"Участника {eid} нет в очереди"
        info = participants.get(eid) or {
            "kind": entry.kind, "name": entry.name,
            "owner_user_id": entry.owner_user_id, "data": {},
        }
        fresh = roll_entry(eid, info, seed)
        # модификатор берём из сцены, если участник ещё там, иначе прежний
        if eid not in participants:
            fresh.modifier = entry.modifier
            fresh.total = sum(fresh.dice) + entry.modifier
        by_id[eid] = fresh

    values = edit.get("values")
    if isinstance(values, dict):
        for eid, raw in values.items():
            entry = by_id.get(str(eid))
            if entry is None:
                return f"Участника {eid} нет в очереди"
            try:
                entry.total = int(raw)
            except (TypeError, ValueError):
                return f"Некорректное значение для {eid}"
            entry.manual = True

    ordered = _str_list(edit.get("order"))
    if ordered:
        ctx.custom_order = True
        seen: set[str] = set()
        entries: list[InitEntry] = []
        for eid in ordered:
            if eid in by_id and eid not in seen:
                seen.add(eid)
                entries.append(by_id[eid])
        # то, что мастер не упомянул в order, но не удалял, идёт в хвост
        for eid, entry in by_id.items():
            if eid not in seen:
                entries.append(entry)
        ctx.entries = entries
    else:
        # dict хранит порядок вставки: прежние позиции сохраняются, новички — в конце
        ctx.entries = list(by_id.values())
        if not ctx.custom_order:
            resort(ctx)
    return None


def to_initiative_state(ctx: InitiativeContext) -> dict[str, Any]:
    """Итоговый блок `initiative` для data сцены."""
    return {
        "order": [e.entity_id for e in ctx.entries],
        "values": {e.entity_id: int(e.total) for e in ctx.entries},
        "active_index": 0,
        "round": 1,
    }
