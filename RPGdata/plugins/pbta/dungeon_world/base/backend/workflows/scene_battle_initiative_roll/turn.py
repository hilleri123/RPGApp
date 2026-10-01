from __future__ import annotations

from typing import Any

from plugins.common.protocols import ResultBuilder, issue
from plugins.common.types import (
    ActionContext,
    ActionInfo,
    ActionParticipants,
    ActionRole,
    SceneContext,
    SubmitResult,
    Workflow,
)

from ...initiative import (
    NO_INITIATIVE_MESSAGE,
    initiative_allowed,
    initiative_of,
    move_turn,
    scene_patch,
    set_turn,
)

STAGE = "initiative.turn"

# допустимые значения input["op"]
_OPS = ("next", "prev", "set", "end")


def _present_ids(scene: SceneContext) -> list[str]:
    return [str(c.id) for c in (scene.characters or [])] + [str(n.id) for n in (scene.npcs or [])]


def _names(scene: SceneContext) -> dict[str, str]:
    out = {str(c.id): c.name for c in (scene.characters or [])}
    out.update({str(n.id): n.name for n in (scene.npcs or [])})
    return out


class InitiativeTurnWorkflow:
    """Ручное переключение хода: дальше, назад, к конкретному участнику, конец боя.

    Основной путь передачи хода — автоматический, после `perform_move` активного
    участника. Это действие нужно мастеру, когда автоматики недостаточно.
    """

    key = "initiative_turn"

    def __init__(self, full_codex: Any = None):
        self.full_codex = full_codex
        self._rb = ResultBuilder(self._visible_ids, self._fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        if role != "gm":
            return []
        if not initiative_allowed(scene.data):
            return []
        if not (initiative_of(scene.data).get("order") or []):
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Очередь ходов",
                roles=["gm"],
                description="Передать ход дальше, вернуться назад, выбрать участника или закончить бой",
            )
        ]

    def _fallback_ids(self, d: dict[str, Any] | None) -> list[str]:
        gm = (d or {}).get("gmUserId")
        return [str(gm)] if gm else []

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        return [str(participants.gmUserId)]

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        if action_context.actorUserId != action_context.participants.gmUserId:
            return self._fail(None, participants, participants_dict, "Очередью ходов управляет только мастер")
        if not initiative_allowed(action_context.scene.data):
            return self._fail(None, participants, participants_dict, NO_INITIATIVE_MESSAGE)
        if not (initiative_of(action_context.scene.data).get("order") or []):
            return self._fail(None, participants, participants_dict, "Инициатива в сцене не брошена")

        scene = action_context.scene
        wf = Workflow(
            actionKey=self.key,
            stageKey=STAGE,
            status="active",
            context={"scene_id": str(scene.id)},
            # снимок очереди на момент открытия: UI показывает имена и текущего
            stageData={"initiative": {**initiative_of(scene.data), "names": _names(scene)}},
        )
        return self._rb.result(
            ok=True, wf=wf, participants=participants,
            participants_dict_fallback=participants_dict, issues=[],
        )

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        if wf is None or wf.status != "active":
            return self._fail(wf, participants, participants_dict, "Workflow is not active")
        if action_context.actorUserId != action_context.participants.gmUserId:
            return self._fail(wf, participants, participants_dict, "Очередью ходов управляет только мастер")

        scene = action_context.scene
        data = scene.data
        inp = action_context.input or {}
        # Кнопка Submit в общем окне действия шлёт пустой input — трактуем как «дальше».
        op = str(inp.get("op") or "next")
        if op not in _OPS:
            return self._fail(wf, participants, participants_dict, "Неизвестная операция")

        if op == "end":
            new_ini: dict | None = {"order": [], "values": {}, "active_index": 0, "round": 1}
            text = "Очередь ходов завершена"
        elif op == "set":
            new_ini = set_turn(data, str(inp.get("entity_id") or ""))
            text = "Ход передан: " + _names(scene).get(str(inp.get("entity_id") or ""), "?")
        else:
            new_ini = move_turn(data, _present_ids(scene), step=1 if op == "next" else -1)
            if new_ini is not None:
                order = new_ini.get("order") or []
                idx = int(new_ini.get("active_index") or 0)
                who = _names(scene).get(str(order[idx]), "?") if order else "?"
                text = f"Ход: {who} (раунд {new_ini.get('round')})"
            else:
                text = ""

        if new_ini is None:
            return self._fail(wf, participants, participants_dict, "Некого делать активным")

        wf.status = "completed"
        wf.stageKey = "completed"
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
            sessionPatch=scene_patch(scene.id, new_ini),
            logEvents=[self._rb.log_text(text, action_key=self.key, tags=["initiative"])],
        )

    def _fail(self, wf, participants, participants_dict, message: str) -> SubmitResult:
        return self._rb.result(
            ok=False,
            wf=wf,
            participants=participants if wf is not None else None,
            participants_dict_fallback=participants_dict,
            issues=[issue("", message)],
        )
