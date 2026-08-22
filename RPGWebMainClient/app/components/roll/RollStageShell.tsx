"use client";

import React from "react";
import { Dices } from "lucide-react";
import { CanvasSeed, DiceRollDisplay, type DiceInterpreter } from "plugins/common/ui";

export type RollModifier = {
  id: string;
  label: string;
  value: number;
};

export type RollSpec = {
  expression?: string;
  modifiers?: RollModifier[];
  interpreter?: string;
  layout?: "combined" | "split";
};

export type RolledState = {
  dice: number[];
  total: number;
  seed?: string | null;
  resultText?: string | null;
  outcome?: string | null;
};

type Props = {
  title?: string;
  summary?: React.ReactNode;
  children?: React.ReactNode;
  rollSpec?: RollSpec | null;
  interpreter: DiceInterpreter;
  rolled?: RolledState | null;
  seed: string | null;
  onSeedChange: (seed: string | null) => void;
  onRoll: () => void;
  rollDisabled?: boolean;
  hint?: string;
  footer?: React.ReactNode;
};

export function RollStageShell({
  title = "Бросок кубиков",
  summary,
  children,
  rollSpec,
  interpreter,
  rolled,
  seed,
  onSeedChange,
  onRoll,
  rollDisabled = false,
  hint,
  footer,
}: Props) {
  const expression = rollSpec?.expression ?? "2d6";
  const modifiers = rollSpec?.modifiers ?? [];
  const hasRolled = Boolean(rolled?.dice?.length);

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <Dices className="w-4 h-4 text-violet-300" />
        {title}
      </div>

      {summary}

      {modifiers.length > 0 && (
        <div className="rounded border border-white10 bg-zinc-950/20 p-3 text-sm space-y-1 font-mono">
          <div className="text-white40 text-xs uppercase tracking-wide">Модификаторы</div>
          {modifiers.map((mod) => (
            <div key={mod.id} className="flex justify-between gap-3">
              <span className="text-white70">{mod.label}</span>
              <span className="text-white">{mod.value >= 0 ? "+" : ""}{mod.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}

      {!hasRolled ? (
        <>
          <CanvasSeed
            onChange={onSeedChange}
            hint={hint ?? `Перемешай кубики и брось ${expression}`}
            disabled={rollDisabled}
          />
          <button
            type="button"
            disabled={rollDisabled || !seed}
            onClick={onRoll}
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              seed && !rollDisabled
                ? "border-violet-400/70 text-violet-200 hover:bg-violet-500/10"
                : "border-white10 text-white30 cursor-not-allowed"
            }`}
          >
            Бросить {expression}
          </button>
        </>
      ) : (
        <DiceRollDisplay
          dice={rolled?.dice ?? []}
          total={rolled?.total ?? 0}
          rollLabel={expression}
          interpreter={interpreter}
          canvasSeed={rolled?.seed ?? null}
          animKey={`${(rolled?.dice ?? []).join(",")}:${rolled?.total ?? 0}`}
        />
      )}

      {hasRolled && rolled?.resultText && (
        <div className="rounded border border-white10 bg-zinc-950/20 px-3 py-2 text-sm font-mono text-white80">
          {rolled.resultText}
        </div>
      )}

      {footer}
    </div>
  );
}
