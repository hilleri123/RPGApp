# Roll Kit — event pipeline для бросков

Roll Kit унифицирует бросок кубиков в workflow-действиях: серверный расчёт,
логирование в журнал сессии и единый UI (`RollStageShell`).

## Компоненты

| Слой | Файл | Назначение |
|------|------|------------|
| Backend | `app/services/roll_service.py` | Детерминированный бросок по seed + `RollSpec` |
| Plugin API | `plugins/common/dice.py` | Re-export для плагинов |
| Events | `app/services/action_events.py` | `broadcast` → `LogRoll`, `logEvents` drafts |
| Pipeline | `app/managers/session/action_manager.py` | `_emit_action_side_effects` после submit |
| Types | `plugins/common/types/action.py` | `SubmitResult.logEvents` |
| Builder | `plugins/common/protocols/stage_base.py` | `ResultBuilder.log_roll`, `log_text` |
| UI | `app/components/roll/RollStageShell.tsx` | Поля плагина + модификаторы + canvas + результат |

## Поток событий

```
Stage.submit()
  → SubmitResult { broadcasts?, logEvents?, workflow }
  → SessionActionManager._emit_action_side_effects()
      → broadcast type=dice.roll  → LogRoll
      → logEvents[]               → LogRoll / LogActionText
      → workflow.status=completed → flush context.entry.log_lines → LogActionText
  → WebSocket field "logs"
```

## RollSpec в stageData

При переходе на roll-стадию плагин может положить в `workflow.stageData`:

```json
{
  "rollSpec": {
    "expression": "2d6",
    "modifiers": [
      { "id": "stat", "label": "STR (16)", "value": 2 },
      { "id": "aid", "label": "Помощь", "value": 1 }
    ],
    "interpreter": "pbta_2d6",
    "layout": "combined"
  }
}
```

`RollStageShell` читает `rollSpec` и показывает сводку модификаторов на одном экране с canvas.

## Как добавить бросок в новый workflow

### Backend (стадия)

1. В `submit()` при переходе на roll-стадию заполните `wf.stageData["rollSpec"]`.
2. Примите `roll_seed` из input, вызовите `roll_from_seed(seed, RollSpec(...))`.
3. Верните `ctx.rb.result(..., logEvents=[ctx.rb.log_roll(...), ctx.rb.log_text(...)])`.
4. Опционально добавьте `broadcasts=[{"type": "dice.roll", ...}]` для совместимости.

### Frontend (стадия)

1. Импортируйте `RollStageShell` из `@/app/components/roll/RollStageShell`.
2. Передайте `rollSpec` из `action.workflow.stageData.rollSpec`.
3. Реализуйте `DiceInterpreter` для раскраски кубиков/исхода.
4. `onRoll` → `onSubmit({ roll_seed: seed })`.

## Примеры в коде

- PbtA perform_move: `plugins/pbta/.../stages/roll.py`, `PerformMoveRollStage.tsx`
- Blades roll: `plugins/blades_in_the_dark/.../stages/prerollconfirm.py`

## Тесты

```bash
cd RPGdata && pytest tests/test_roll_kit.py -q
```
