"""Порядок инициативы в сцене Dungeon World.

Модуль без зависимостей от workflow-движка: им пользуются и workflow броска
инициативы, и `perform_move`, когда после хода надо передать очередь дальше.

Формула: 2d6 + модификатор ЛОВ. Порядок — по убыванию итога; при равенстве
персонажи игроков идут раньше NPC, дальше по имени (детерминированно).
"""

from __future__ import annotations

from typing import Any, Iterable, Optional

from .codex.pbta_skills import stat_modifier
from .scene_context import normalize_scene_mode

NO_INITIATIVE_MESSAGE = "В лагере и в пути инициатива не ведётся — только в сцене действия"


def initiative_allowed(scene_data: Optional[dict[str, Any]]) -> bool:
    """Очередь ходов ведётся только в сцене действия; в лагере и в пути её нет.

    Уже записанная очередь при смене типа сцены не стирается — она просто
    не действует и вернётся, если снова включить «Действие».
    """
    return normalize_scene_mode((scene_data or {}).get("mode")) == "action"


def dex_modifier(data: Optional[dict[str, Any]]) -> int:
    """Модификатор ЛОВ сущности.

    Порядок источников: явный `initiative_mod`, готовый `stat_modifiers.dex`,
    иначе считаем из значения `stats.dex`. У NPC характеристик обычно нет —
    для них модификатор 0.
    """
    d = data if isinstance(data, dict) else {}

    explicit = d.get("initiative_mod")
    if isinstance(explicit, (int, float)) and not isinstance(explicit, bool):
        return int(explicit)

    mods = d.get("stat_modifiers")
    if isinstance(mods, dict) and isinstance(mods.get("dex"), (int, float)):
        return int(mods["dex"])

    stats = d.get("stats")
    if isinstance(stats, dict) and isinstance(stats.get("dex"), (int, float)):
        return stat_modifier(int(stats["dex"]))

    return 0


def sort_key(kind: str, name: str, total: int, entity_id: str) -> tuple:
    return (-int(total), 0 if kind == "character" else 1, (name or "").lower(), str(entity_id))


def initiative_of(scene_data: Optional[dict[str, Any]]) -> dict[str, Any]:
    raw = (scene_data or {}).get("initiative")
    return raw if isinstance(raw, dict) else {}


def _order(ini: dict[str, Any]) -> list[str]:
    return [str(x) for x in (ini.get("order") or []) if x]


def _index(ini: dict[str, Any]) -> int:
    order = _order(ini)
    try:
        i = int(ini.get("active_index") or 0)
    except (TypeError, ValueError):
        i = 0
    return i if 0 <= i < len(order) else 0


def active_entity_id(scene_data: Optional[dict[str, Any]]) -> Optional[str]:
    ini = initiative_of(scene_data)
    order = _order(ini)
    return order[_index(ini)] if order else None


def _next_present(
    order: list[str],
    start: int,
    present: set[str],
    step: int,
) -> Optional[tuple[int, bool]]:
    """Ближайший присутствующий участник от `start` в направлении `step`.

    Возвращает (индекс, перешагнули_ли_границу_круга).
    """
    n = len(order)
    for shift in range(1, n + 1):
        raw = start + step * shift
        j = raw % n
        if order[j] in present:
            wrapped = raw >= n if step > 0 else raw < 0
            return j, wrapped
    return None


def move_turn(
    scene_data: Optional[dict[str, Any]],
    present_ids: Iterable[str],
    *,
    step: int = 1,
) -> Optional[dict[str, Any]]:
    """Передвигает очередь на следующего (step=1) или предыдущего (step=-1).

    Тех, кого уже нет в сцене, пропускает. Возвращает новый блок `initiative`
    или None, если двигать нечего.
    """
    ini = initiative_of(scene_data)
    order = _order(ini)
    if not order:
        return None

    found = _next_present(order, _index(ini), set(str(x) for x in present_ids), 1 if step >= 0 else -1)
    if found is None:
        return None
    j, wrapped = found

    rnd = int(ini.get("round") or 1)
    if wrapped:
        rnd = rnd + 1 if step >= 0 else max(1, rnd - 1)

    return {**ini, "order": order, "active_index": j, "round": rnd}


def set_turn(scene_data: Optional[dict[str, Any]], entity_id: str) -> Optional[dict[str, Any]]:
    ini = initiative_of(scene_data)
    order = _order(ini)
    if str(entity_id) not in order:
        return None
    return {**ini, "order": order, "active_index": order.index(str(entity_id))}


def advance_after_actor(
    scene_data: Optional[dict[str, Any]],
    actor_id: Optional[str],
    present_ids: Iterable[str],
) -> Optional[dict[str, Any]]:
    """Передаёт ход дальше, если завершил действие тот, чей сейчас ход.

    Реакции вне очереди (защита, помощь, ход по требованию мастера) очередь не
    двигают: пока действует не активный участник, ничего не меняется.
    """
    if not actor_id or not initiative_allowed(scene_data):
        return None
    if active_entity_id(scene_data) != str(actor_id):
        return None
    return move_turn(scene_data, present_ids, step=1)


def scene_patch(scene_id: Any, initiative: dict[str, Any]) -> dict[str, Any]:
    """sessionPatch, который записывает блок `initiative` в data сцены."""
    return {"scenes": [{"id": str(scene_id), "dataPatch": {"initiative": initiative}}]}


def merge_patches(a: Optional[dict[str, Any]], b: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Склеивает два sessionPatch, не трогая исходные словари."""
    if not a:
        return b
    if not b:
        return a
    out: dict[str, Any] = {k: list(v or []) for k, v in a.items()}
    for key, items in b.items():
        out.setdefault(key, []).extend(list(items or []))
    return out
