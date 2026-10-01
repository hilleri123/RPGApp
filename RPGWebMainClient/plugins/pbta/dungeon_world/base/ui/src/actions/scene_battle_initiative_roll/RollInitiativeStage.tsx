'use client';

import { useEffect, useState } from 'react';
import { CanvasSeed, DiceRollDisplay, SeedTooltip, neutralDiceInterpreter, seedImageUrl } from '@/plugins/common/ui';
import { Dices as DicesIcon } from 'lucide-react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { ArrowDown, ArrowUp, Dices, Trash2 } from 'lucide-react';

type Entry = {
  entity_id: string;
  kind: 'character' | 'npc';
  name: string;
  owner_user_id?: string | null;
  rolled?: boolean;
  roll_seed?: string;
  seed_image_ref?: string | null;
  modifier: number;
  dice: number[];
  total: number;
  manual: boolean;
};

type Candidate = { id: string; kind: 'character' | 'npc'; name: string; modifier: number };

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function RollPhase(props: ActionHandlerProps) {
  const { user_id, action, onSubmit, setSubmitEnabled, readOnly = false } = props;

  const wf: any = action?.workflow ?? {};
  const entries: Entry[] = Array.isArray(wf.context?.entries) ? wf.context.entries : [];
  const npcSeed = String(wf.context?.npc_seed ?? '');
  const active = wf.status === 'active';

  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id);
  const mine = entries.filter((e) => e.kind === 'character' && String(e.owner_user_id ?? '') === String(user_id));
  const minePending = mine.filter((e) => !e.rolled);
  const gmGroupPending = entries.filter((e) => !e.rolled && (e.kind === 'npc' || !e.owner_user_id));
  const waitingPlayers = entries.filter((e) => !e.rolled && e.kind === 'character' && e.owner_user_id);

  const canRoll = active && !readOnly && minePending.length > 0;
  const canRollGroup = active && !readOnly && isGm && gmGroupPending.length > 0;
  const canProceed = active && !readOnly && isGm;
  const needsSeed = canRoll || canRollGroup || canProceed;

  // Любой бросок идёт от жеста (CanvasSeed), поэтому общий Submit тут не нужен:
  // бросают кнопки ниже, а жест сбрасывается после каждого броска.
  useEffect(() => {
    setSubmitEnabled(false);
  }, [setSubmitEnabled]);

  const [seed, setSeed] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const seedReady = Boolean(seed);
  const fire = (op: 'roll' | 'roll_npcs' | 'proceed') => {
    if (!seed) return;
    onSubmit({ op, roll_seed: seed });
    setSeed(null);
    setCanvasKey((k) => k + 1);
  };

  const btn =
    'inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm disabled:opacity-40 border-gray-700 bg-gray-900 text-gray-100 hover:border-violet-500/60';
  const primary = `${btn} !border-violet-500/60 !bg-violet-500/15`;

  // Игроку, который ещё не бросил, показываем только полотно и кнопку броска.
  if (!isGm && canRoll) {
    return (
      <div className="space-y-3 text-sm text-gray-200">
        <CanvasSeed
          key={canvasKey}
          onChange={setSeed}
          hint={`Бросок инициативы: 2d6 + ЛОВ за ${minePending.map((e) => e.name || '—').join(', ')}`}
        />
        <button type="button" className={primary} disabled={!seedReady} onClick={() => fire('roll')}>
          <DicesIcon size={16} /> Бросить
        </button>
      </div>
    );
  }

  const rolledEntries = entries.filter((e) => e.rolled);
  const unrolledEntries = entries.filter((e) => !e.rolled);

  return (
    <div className="space-y-3 text-sm text-gray-200">
      {isGm ? (
        <div className="rounded border border-gray-700 bg-black/20 p-3">
          <div className="font-medium">Инициатива: броски</div>
          <p className="mt-1 text-xs text-gray-400">
            Игроки бросают за своих персонажей сами, мастер — за всех NPC от одного жеста. Когда бросят все,
            мастер выровняет очередность.
          </p>
        </div>
      ) : null}

      {isGm && needsSeed ? (
        <>
          <CanvasSeed
            key={canvasKey}
            onChange={setSeed}
            hint="Жест для бросков мастера. После каждого броска рисуйте заново."
          />
          <div className="flex flex-wrap gap-2">
            {minePending.length > 0 ? (
              <button type="button" className={primary} disabled={!seedReady} onClick={() => fire('roll')}>
                <DicesIcon size={16} /> Бросить за {minePending.map((e) => e.name || '—').join(', ')}
              </button>
            ) : null}
            <button
              type="button"
              className={canRollGroup && minePending.length === 0 ? primary : btn}
              disabled={!canRollGroup || !seedReady}
              onClick={() => fire('roll_npcs')}
              title="Один жест на всех NPC (и персонажей без игрока)"
            >
              <DicesIcon size={16} /> Бросить за NPC
            </button>
            <button
              type="button"
              className={`${btn} ml-auto`}
              disabled={!canProceed || !seedReady}
              onClick={() => fire('proceed')}
              title="За не бросивших игроков бросит мастер от своего жеста"
            >
              К расстановке →
            </button>
          </div>
        </>
      ) : null}

      {isGm && waitingPlayers.length > 0 ? (
        <p className="text-xs text-amber-200/80">
          Ещё не бросили: {waitingPlayers.map((e) => e.name || '—').join(', ')}. Если ждать не хотите — «К расстановке»
          бросит за них от вашего жеста.
        </p>
      ) : null}

      {/* Кто как бросил: стандартный показ кубов с иконкой рисунка-seed */}
      <div className="space-y-2">
        {rolledEntries.map((e) => (
          <DiceRollDisplay
            key={e.entity_id}
            animKey={`${e.entity_id}:${e.roll_seed ?? ''}`}
            dice={e.dice}
            total={e.total}
            rollLabel={`${e.name || '—'}${e.kind === 'npc' ? ' (NPC)' : ''}${
              String(e.owner_user_id ?? '') === String(user_id) ? ' · вы' : ''
            } · 2d6 ${fmtMod(e.modifier)} ЛОВ`}
            interpreter={neutralDiceInterpreter}
            canvasSeed={seedImageUrl(e.seed_image_ref, e.roll_seed)}
          />
        ))}
        {rolledEntries.length === 0 ? <p className="text-xs text-gray-500">Пока никто не бросил.</p> : null}
      </div>

      {unrolledEntries.length > 0 ? (
        <ul className="space-y-1">
          {unrolledEntries.map((e) => (
            <li
              key={e.entity_id}
              className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900/30 px-2 py-1.5 text-xs text-gray-500"
            >
              <span className="min-w-0 flex-1 truncate text-gray-300">
                {e.name || '—'}
                {e.kind === 'npc' ? <span className="ml-1 text-gray-500">NPC</span> : null}
              </span>
              <span>{e.kind === 'npc' || !e.owner_user_id ? 'бросит мастер' : 'ждёт броска игрока'}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {npcSeed ? (
        <p className="text-[11px] text-gray-500">
          жест NPC: <span className="font-mono">{npcSeed.slice(0, 8)}</span> — кубы каждого NPC выводятся из него
        </p>
      ) : null}
    </div>
  );
}

export default function RollInitiativeStage(props: ActionHandlerProps) {
  const stageKey = String(props.stageKey ?? (props.action?.workflow as any)?.stageKey ?? '');
  if (stageKey === 'initiative.roll') return <RollPhase {...props} />;
  return <ReviewPhase {...props} />;
}

function ReviewPhase(props: ActionHandlerProps) {
  const { user_id, action, onPatch, setSubmitEnabled, stageKey: viewKey, readOnly = false } = props;

  const wf: any = action?.workflow ?? {};
  const stageKey = String(viewKey ?? wf.stageKey ?? '');
  const entries: Entry[] = Array.isArray(wf.context?.entries) ? wf.context.entries : [];
  const candidates: Candidate[] = Array.isArray(wf.stageData?.candidates) ? wf.stageData.candidates : [];

  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id);
  const isReview = stageKey === 'initiative.review' && wf.status === 'active';
  const canEdit = isReview && isGm && !readOnly && typeof onPatch === 'function';

  useEffect(() => {
    setSubmitEnabled(isReview && isGm && entries.length > 0);
  }, [isReview, isGm, entries.length, setSubmitEnabled]);

  // Переброс и добавление тоже идут от жеста; после каждого использования рисуем заново.
  const [seed, setSeed] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const seedReady = Boolean(seed);

  const patch = (p: Record<string, unknown>) => onPatch?.(p);
  const rollPatch = (p: Record<string, unknown>) => {
    if (!seed) return;
    onPatch?.({ ...p, roll_seed: seed });
    setSeed(null);
    setCanvasKey((k) => k + 1);
  };
  const ids = entries.map((e) => e.entity_id);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[idx], next[j]] = [next[j], next[idx]];
    patch({ order: next });
  };

  return (
    <div className="space-y-3 text-sm text-gray-200">
      <div className="rounded border border-gray-700 bg-black/20 p-3">
        <div className="font-medium">
          {isReview ? 'Инициатива: проверьте порядок' : 'Инициатива'}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {isReview
            ? isGm
              ? 'Каждый бросил 2d6 + ЛОВ. Можно поменять порядок, перебросить, задать значение или добавить участника. Submit — утвердить.'
              : 'Мастер определяет порядок ходов.'
            : 'Порядок утверждён и записан в сцену.'}
        </p>
      </div>

      <ol className="space-y-1">
        {entries.map((e, idx) => (
          <li
            key={e.entity_id}
            className="flex items-center gap-2 rounded border border-gray-700 bg-gray-900/40 px-2 py-1.5"
          >
            <span className="w-5 text-xs tabular-nums text-gray-500">{idx + 1}</span>

            <div className="min-w-0 flex-1">
              <div className="truncate text-gray-100">
                {e.name || '—'}
                {e.kind === 'npc' ? <span className="ml-1 text-xs text-gray-500">NPC</span> : null}
              </div>
              <div className="text-xs text-gray-500 tabular-nums">
                {e.manual
                  ? 'значение задано мастером'
                  : `${e.dice.join(' + ')} ${fmtMod(e.modifier)} ЛОВ`}
              </div>
            </div>

            {seedImageUrl(e.seed_image_ref, e.roll_seed) ? (
              <SeedTooltip src={seedImageUrl(e.seed_image_ref, e.roll_seed)!} />
            ) : null}

            {canEdit ? (
              <input
                type="number"
                defaultValue={e.total}
                key={`${e.entity_id}:${e.total}`}
                title="Итог"
                onBlur={(ev) => {
                  const v = Number.parseInt(ev.target.value, 10);
                  if (Number.isFinite(v) && v !== e.total) patch({ values: { [e.entity_id]: v } });
                }}
                className="w-14 rounded border border-gray-700 bg-gray-900 px-1 py-0.5 text-center text-gray-100"
              />
            ) : (
              <span className="w-10 text-center text-base font-semibold tabular-nums">{e.total}</span>
            )}

            {canEdit ? (
              <>
                <button
                  type="button"
                  title={seedReady ? 'Перебросить (от нарисованного жеста)' : 'Сначала нарисуйте жест'}
                  disabled={!seedReady}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                  onClick={() => rollPatch({ reroll: [e.entity_id] })}
                >
                  <Dices size={15} />
                </button>
                <button
                  type="button"
                  title="Выше"
                  disabled={idx === 0}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                  onClick={() => move(idx, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  title="Ниже"
                  disabled={idx === entries.length - 1}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                  onClick={() => move(idx, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  title="Убрать из очереди"
                  className="p-1 text-gray-400 hover:text-red-300"
                  onClick={() => patch({ remove: [e.entity_id] })}
                >
                  <Trash2 size={15} />
                </button>
              </>
            ) : null}
          </li>
        ))}
        {entries.length === 0 ? <li className="text-xs text-gray-500">Очередь пуста.</li> : null}
      </ol>

      {/* {canEdit ? (
        <CanvasSeed
          key={canvasKey}
          onChange={setSeed}
          hint="Жест для переброса или добавления участника. Один жест — один бросок."
        />
      ) : null} */}

      {canEdit && candidates.length ? (
        <div className="rounded border border-gray-700 bg-black/20 p-2">
          <div className="mb-1 text-xs text-gray-400">Добавить в очередь (бросок 2d6 + ЛОВ от жеста)</div>
          {/* <div className="flex flex-wrap gap-1.5">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!seedReady}
                title={seedReady ? undefined : 'Сначала нарисуйте жест'}
                onClick={() => rollPatch({ add: [c.id] })}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:border-violet-500/60 hover:text-violet-100 disabled:opacity-40"
              >
                + {c.name || '—'}
                {c.kind === 'npc' ? ' (NPC)' : ''} {fmtMod(c.modifier)}
              </button>
            ))}
          </div> */}
        </div>
      ) : null}
    </div>
  );
}
