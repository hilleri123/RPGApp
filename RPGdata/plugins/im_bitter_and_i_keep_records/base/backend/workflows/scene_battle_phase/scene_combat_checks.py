# scene_combat_checks.py
from __future__ import annotations
from typing import Any

def _scene_combat(scene: dict[str, Any]) -> dict[str, Any]:
    data = scene.get("data") if isinstance(scene.get("data"), dict) else {}
    combat = data.get("combat") if isinstance(data.get("combat"), dict) else {}
    return combat

def compute_phase_pending(scene: dict[str, Any]) -> list[str]:
    """
    Возвращает список текстовых проблем, которые должны быть решены до смены фазы.
    Ты потом заменишь строки на структурированные objects.
    """
    combat = _scene_combat(scene)
    phase = str(combat.get("phase") or "turn")

    order = combat.get("initiativeOrder") if isinstance(combat.get("initiativeOrder"), list) else []
    active_index = combat.get("activeIndex")

    pending: list[str] = []

    # пример 1: нет инициативы вообще
    if not order:
        pending.append("initiativeOrder is empty")

    # пример 2: activeIndex вне диапазона
    if isinstance(active_index, int) and order and (active_index < 0 or active_index >= len(order)):
        pending.append("activeIndex is out of range")

    # пример 3: после turn ожидаем contacts
    if phase == "turn":
        contacts = combat.get("contacts") if isinstance(combat.get("contacts"), list) else []
        if not contacts:
            pending.append("contacts are not set after turn phase")

    # пример 4: “не все сходили” (если ты это считаешь)
    # Сейчас у тебя есть только activeIndex — этого недостаточно понять "кто сходил".
    # Нужен combat.turnDoneIds или combat.roundCounter+per-actor flags.
    # pending.append("not everyone acted this round")

    return pending
