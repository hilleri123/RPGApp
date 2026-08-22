'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { DiceInterpreter } from '../../DiceRollDisplay';
import { DiceRollDisplay } from '../../DiceRollDisplay';
import { RollStageShell } from '@/app/components/roll/RollStageShell';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';

const DECLARE_KEY = 'common.free_dice_roll.declare';
const ROLL_KEY = 'common.free_dice_roll.roll';
const RESULT_KEY = 'common.free_dice_roll.result';

const DICE_RE = /^\s*(\d+)\s*d\s*(\d+)\s*$/i;

function isValidExpression(expr: string): boolean {
  return DICE_RE.test((expr || '').trim());
}

const genericInterpreter: DiceInterpreter = ({ dice }) => ({
  dieColors: (dice ?? []).map(() => 'neutral' as const),
  outcome: null,
});

type FreeDiceCtx = {
  declaration?: string;
  expression?: string;
  actor_user_id?: string;
  roll?: { dice?: number[]; total?: number; roll_seed?: string; expression?: string };
};

export default function FreeDiceRollStage({
  action,
  value,
  onPatch,
  onSubmit,
  setSubmitEnabled,
  stageKey,
  readOnly,
  user_id,
}: ActionHandlerProps) {
  const wf = action?.workflow ?? {};
  const ctx = (wf.context ?? {}) as FreeDiceCtx;

  const effectiveStage = stageKey ?? String(wf.stageKey ?? DECLARE_KEY);

  if (effectiveStage === RESULT_KEY || wf.stageKey === RESULT_KEY) {
    return (
      <FreeDiceResultView
        ctx={ctx}
        userId={user_id}
        action={action}
        setSubmitEnabled={setSubmitEnabled}
      />
    );
  }

  if (effectiveStage === ROLL_KEY || wf.stageKey === ROLL_KEY) {
    return (
      <FreeDiceRollRollStage
        action={action}
        ctx={ctx}
        onPatch={onPatch}
        onSubmit={onSubmit}
        setSubmitEnabled={setSubmitEnabled}
        readOnly={readOnly}
      />
    );
  }

  return (
    <FreeDiceDeclareStage
      ctx={ctx}
      value={value}
      onPatch={onPatch}
      setSubmitEnabled={setSubmitEnabled}
      readOnly={readOnly}
    />
  );
}

function FreeDiceDeclareStage({
  ctx,
  value,
  onPatch,
  setSubmitEnabled,
  readOnly,
}: {
  ctx: FreeDiceCtx;
  value: Record<string, unknown>;
  onPatch?: (patch: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
  readOnly?: boolean;
}) {
  const declaration = String(value?.declaration ?? ctx.declaration ?? '');
  const expression = String(value?.expression ?? ctx.expression ?? '1d6');

  useEffect(() => {
    onPatch?.({ declaration, expression });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSubmitEnabled(isValidExpression(expression));
  }, [expression, setSubmitEnabled]);

  const sync = (patch: Record<string, unknown>) => {
    onPatch?.(patch);
  };

  return (
    <div className="rounded border border-zinc-700 p-4 space-y-4">
      <div className="font-medium text-gray-100">Свободный бросок</div>
      <p className="text-xs text-gray-400">
        Опишите заявку и укажите кубы в формате NdM (например 1d6, 2d6, 4d8). На следующем шаге нарисуйте seed и бросьте.
      </p>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        <span>Описание заявки</span>
        <textarea
          className="min-h-[4rem] rounded border border-zinc-700 bg-zinc-950/60 text-sm text-gray-100 px-2 py-1.5 resize-y"
          value={declaration}
          disabled={readOnly}
          placeholder="Что вы делаете и зачем бросаете кубы…"
          onChange={(e) => sync({ declaration: e.target.value, expression })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400 max-w-xs">
        <span>Кубы</span>
        <input
          className="rounded border border-zinc-700 bg-zinc-950/60 text-sm font-mono text-gray-100 px-2 py-1.5"
          value={expression}
          disabled={readOnly}
          placeholder="1d6"
          onChange={(e) => sync({ expression: e.target.value, declaration })}
        />
        {!isValidExpression(expression) && expression.trim() ? (
          <span className="text-amber-400/90">Формат: число d число, например 2d6</span>
        ) : null}
      </label>
    </div>
  );
}

function FreeDiceRollRollStage({
  action,
  ctx,
  onPatch,
  onSubmit,
  setSubmitEnabled,
  readOnly,
}: {
  action: ActionHandlerProps['action'];
  ctx: FreeDiceCtx;
  onPatch?: (patch: Record<string, unknown>) => void;
  onSubmit: (payload?: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
  readOnly?: boolean;
}) {
  const wf = action?.workflow ?? {};
  const rollSpec = (wf.stageData as { rollSpec?: { expression?: string } } | undefined)?.rollSpec ?? null;
  const expression = rollSpec?.expression ?? ctx.expression ?? '1d6';
  const roll = ctx.roll ?? {};
  const alreadyRolled = Array.isArray(roll.dice) && roll.dice.length > 0;

  const [seed, setSeed] = useState<string | null>(null);

  useEffect(() => {
    setSubmitEnabled(false);
  }, [setSubmitEnabled]);

  const summary = useMemo(() => {
    const decl = (ctx.declaration ?? '').trim();
    if (!decl && !expression) return null;
    return (
      <div className="rounded border border-white/10 bg-zinc-950/30 p-3 text-sm space-y-1">
        {decl ? (
          <div>
            <span className="text-white/40 text-xs uppercase">Заявка</span>
            <div className="text-gray-200 whitespace-pre-wrap">{decl}</div>
          </div>
        ) : null}
        <div className="font-mono text-violet-200">{expression}</div>
      </div>
    );
  }, [ctx.declaration, expression]);

  const handleSeedChange = (s: string | null) => {
    if (readOnly) return;
    setSeed(s);
    onPatch?.({ roll_seed: s });
    setSubmitEnabled(!!s && !alreadyRolled);
  };

  return (
    <RollStageShell
      title="Свободный бросок"
      summary={summary}
      rollSpec={rollSpec ?? { expression, interpreter: 'generic', layout: 'combined' }}
      interpreter={genericInterpreter}
      seed={seed}
      onSeedChange={handleSeedChange}
      onRoll={() => {
        if (!readOnly && seed && !alreadyRolled) {
          onSubmit({ roll_seed: seed });
        }
      }}
      rollDisabled={alreadyRolled || !!readOnly}
      rolled={
        alreadyRolled
          ? {
              dice: roll.dice ?? [],
              total: roll.total ?? 0,
              seed: roll.roll_seed ?? null,
            }
          : null
      }
      hint={`Нарисуйте seed и бросьте ${expression}`}
    />
  );
}

function FreeDiceResultView({
  ctx,
  userId,
  action,
  setSubmitEnabled,
}: {
  ctx: FreeDiceCtx;
  userId?: string;
  action: ActionHandlerProps['action'];
  setSubmitEnabled: (e: boolean) => void;
}) {
  const expression = ctx.roll?.expression ?? ctx.expression ?? '1d6';
  const dice = ctx.roll?.dice ?? [];
  const total = ctx.roll?.total ?? 0;
  const decl = (ctx.declaration ?? '').trim();

  const gmId = action?.participants?.gmUserId;
  const actorId = ctx.actor_user_id;
  const canClose =
    !!userId && (String(userId) === String(gmId) || String(userId) === String(actorId));

  useEffect(() => {
    setSubmitEnabled(canClose);
  }, [canClose, setSubmitEnabled]);

  return (
    <div className="rounded border border-zinc-700 p-4 space-y-4">
      <div className="font-medium text-gray-100">Результат свободного броска</div>
      {decl ? (
        <div className="rounded border border-white/10 bg-zinc-950/30 p-3 text-sm">
          <span className="text-white/40 text-xs uppercase">Заявка</span>
          <div className="text-gray-200 whitespace-pre-wrap mt-1">{decl}</div>
        </div>
      ) : null}
      <div className="font-mono text-sm text-violet-200">{expression}</div>
      <DiceRollDisplay
        dice={dice}
        total={total}
        interpreter={genericInterpreter}
        canvasSeed={ctx.roll?.roll_seed ?? null}
        animKey={`${dice.join(',')}:${total}`}
      />
      <div className="text-center text-2xl font-semibold text-white tabular-nums">
        Итого: {total}
      </div>
      <p className="text-xs text-gray-400 text-center">
        {canClose
          ? 'Нажмите Submit, чтобы закрыть результат для всех.'
          : 'Результат виден всем. Закрыть может инициатор или мастер.'}
      </p>
    </div>
  );
}
