from __future__ import annotations

from ...types import CombatPhase
from plugins.common.types import SceneContext  # или откуда у тебя SceneContext/Scene берется
from .types_scene_switch_phase import PendingAction, CombatPhaseSnapshot


_PHASE_ORDER: list[CombatPhase] = ["move", "melee", "ranged", "other"]



def get_next_phase(cur: CombatPhase) -> CombatPhase:
    i = _PHASE_ORDER.index(cur)
    return _PHASE_ORDER[(i + 1) % len(_PHASE_ORDER)]


def make_snapshot(scene: SceneContext) -> CombatPhaseSnapshot:
    data = scene.data
    if data.mode != "combat" or data.combat is None:
        return CombatPhaseSnapshot(
            currentPhase="move",
            initiativeOrder=[],
            activeIndex=0,
            contactsCount=0,
        )

    combat = data.combat

    order = [x.strip() for x in (combat.initiativeOrder or []) if isinstance(x, str) and x.strip()]
    active_index = combat.activeIndex if isinstance(combat.activeIndex, int) and combat.activeIndex >= 0 else 0
    contacts_count = len(combat.contacts or [])

    return CombatPhaseSnapshot(
        currentPhase=scene.data.combat.phase,
        initiativeOrder=order,
        activeIndex=active_index,
        contactsCount=contacts_count,
    )


def compute_pending(scene: SceneContext) -> list[PendingAction]:
    """
    Пока базово. Потом расширишь: не все сходили, незавершённые workflow и т.д.
    """
    data = scene.data
    if data.mode != "combat" or data.combat is None:
        return []

    combat = data.combat
    pending: list[PendingAction] = []

    order = [x.strip() for x in (combat.initiativeOrder or []) if isinstance(x, str) and x.strip()]
    if not order:
        pending.append(PendingAction(id="initiative", action="initiativeOrder.empty", meta={}))

    cur = scene.data.combat.phase
    if cur == "move":
        if not (combat.contacts or []):
            pending.append(PendingAction(id="contacts", action="contacts.missing_after_move", meta={}))

    return pending
