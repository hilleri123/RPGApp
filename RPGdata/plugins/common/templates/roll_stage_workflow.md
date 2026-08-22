# Шаблон roll-стадии workflow

Используйте как чеклист при добавлении стадии с броском кубиков.

## Backend (`stages/my_roll.py`)

```python
from plugins.common.dice import RollSpec, roll_from_seed
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import SubmitResult, Workflow


class MyRollStage(BaseStage):
    key = "my_action.roll"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict) -> SubmitResult:
        seed = (input_dict or {}).get("roll_seed")
        if not seed:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("roll_seed", "Seed required")],
            )

        spec = RollSpec(
            expression="2d6",
            modifiers=[{"id": "stat", "label": "MOD", "value": 0}],
            interpreter="generic",
            layout="combined",
        )
        result = roll_from_seed(str(seed), spec)

        wf.stageKey = "my_action.resolve"
        wf.stageData = {"rollSpec": spec.model_dump(mode="json")}

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            logEvents=[
                ctx.rb.log_roll(
                    title="My roll",
                    dice=result.dice,
                    total=result.total,
                    seed=str(seed),
                ),
            ],
            broadcasts=[{
                "type": "dice.roll",
                "rolls": result.dice,
                "total": result.total,
            }],
        )
```

## Frontend (`stages/MyRollStage.tsx`)

```tsx
import { RollStageShell } from "@/app/components/roll/RollStageShell";
import type { DiceInterpreter } from "plugins/common/ui";

const interpreter: DiceInterpreter = ({ total }) => ({
  dieColors: ["neutral", "neutral"],
  outcome: total != null ? { label: String(total), color: "neutral" } : null,
});

export function MyRollStage({ action, onSubmit, patch, setSubmitEnabled }) {
  const rollSpec = action?.workflow?.stageData?.rollSpec ?? null;
  const [seed, setSeed] = useState<string | null>(null);

  return (
    <RollStageShell
      rollSpec={rollSpec}
      interpreter={interpreter}
      seed={seed}
      onSeedChange={(s) => { setSeed(s); patch({ roll_seed: s }); setSubmitEnabled(!!s); }}
      onRoll={() => seed && onSubmit({ roll_seed: seed })}
    />
  );
}
```

## Переход на roll-стадию (предыдущая стадия)

```python
from ..helpers import attach_roll_stage_data  # или свой build_roll_stage_data

wf.stageKey = "my_action.roll"
attach_roll_stage_data(wf, context_model)  # PbtA helper
# или: wf.stageData = {"rollSpec": {...}}
```
