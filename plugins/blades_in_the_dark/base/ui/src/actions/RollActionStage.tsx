'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { SessionAction } from '@/app/services/types/session';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { ValidationIssue } from '../types';

type StageKey =
  | 'choose_action'
  | 'gm_set_position_effect'
  | 'confirm_or_repick'
  | 'roll'
  | 'resist'
  | 'done';

type Envelope = {
  stageKey: StageKey;
  stageData?: any;
  ui?: { component: string; props?: any } | null;
  broadcasts?: any[];
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function getEnvelopeFromValue(value: any): Envelope {
  // поддержим оба варианта:
  // 1) value === envelope
  // 2) value.envelope === envelope
  const v = value ?? {};
  const env = (v.envelope ?? v) as Envelope;
  return env?.stageKey ? env : { stageKey: 'done' };
}

function setEnvelopeToValue(prev: any, nextEnv: Envelope) {
  const p = prev ?? {};
  // если ранее был формат { envelope: ... } — сохраняем его
  if (p && typeof p === 'object' && 'envelope' in p) return { ...p, envelope: nextEnv };
  return nextEnv;
}

export default function RollActionStage(props: ActionHandlerProps & { issues?: ValidationIssue[] }) {
  const { action, value, onChange, issues } = props;

  const envelope = useMemo(() => getEnvelopeFromValue(value), [value]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const patchEnvelope = (patch: Partial<Envelope>) => {
    const nextEnv: Envelope = { ...envelope, ...patch };
    onChange(setEnvelopeToValue(value, nextEnv));
  };

  const patchStageData = (patch: any) => {
    const nextEnv: Envelope = {
      ...envelope,
      stageData: { ...(envelope.stageData ?? {}), ...(patch ?? {}) },
    };
    onChange(setEnvelopeToValue(value, nextEnv));
  };

  // ------- choose_action -------
  const ChooseAction = () => {
    const actions: string[] =
      envelope?.ui?.props?.actions ??
      ['hunt', 'study', 'survey', 'tinker', 'finesse', 'prowl', 'skirmish', 'wreck', 'attune', 'command', 'consort', 'sway'];

    const selected = envelope?.stageData?.action ?? actions[0] ?? 'hunt';

    return (
      <div className="rounded border p-3 flex flex-col gap-3">
        <div className="font-medium">Выбор action</div>
        <div className="text-sm text-muted-foreground">Какой action используешь?</div>

        <select
          className="w-full border rounded px-3 py-2 text-sm bg-background"
          value={selected}
          onChange={(e) => patchStageData({ action: e.target.value })}
        >
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {err('action') ? <div className="text-xs text-red-500">{err('action')}</div> : null}

        <div className="text-xs text-muted-foreground">
          Нажми Submit внизу диалога, чтобы отправить выбор на сервер.
        </div>
      </div>
    );
  };

  // ------- gm_set_position_effect -------
  const GmSetPositionEffect = () => {
    const positions: string[] = envelope?.ui?.props?.positions ?? ['controlled', 'risky', 'desperate'];
    const effects: string[] = envelope?.ui?.props?.effects ?? ['limited', 'standard', 'great'];

    const position = envelope?.stageData?.position ?? positions[1] ?? 'risky';
    const effect = envelope?.stageData?.effect ?? effects[1] ?? 'standard';
    const consequenceHint = envelope?.stageData?.consequence_hint ?? '';

    const selectedAction = envelope?.stageData?.selectedAction;

    return (
      <div className="rounded border p-3 flex flex-col gap-3">
        <div className="font-medium">Мастер: задание position/effect</div>
        <div className="text-sm text-muted-foreground">Action игрока: {selectedAction ?? '—'}</div>

        <div>
          <div className="text-sm text-muted-foreground">Position</div>
          <select
            className="w-full border rounded px-3 py-2 text-sm bg-background"
            value={position}
            onChange={(e) => patchStageData({ position: e.target.value })}
          >
            {positions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {err('position') ? <div className="text-xs text-red-500 mt-1">{err('position')}</div> : null}
        </div>

        <div>
          <div className="text-sm text-muted-foreground">Effect</div>
          <select
            className="w-full border rounded px-3 py-2 text-sm bg-background"
            value={effect}
            onChange={(e) => patchStageData({ effect: e.target.value })}
          >
            {effects.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          {err('effect') ? <div className="text-xs text-red-500 mt-1">{err('effect')}</div> : null}
        </div>

        <div>
          <div className="text-sm text-muted-foreground">Consequence hint (опц.)</div>
          <Input
            value={consequenceHint}
            onChange={(e) => patchStageData({ consequence_hint: e.target.value })}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Нажми Submit внизу диалога, чтобы отправить мастера/игроку.
        </div>
      </div>
    );
  };

  // ------- confirm_or_repick -------
  const ConfirmOrRepick = () => {
    const d = envelope?.stageData ?? {};
    return (
      <div className="rounded border p-3 flex flex-col gap-3">
        <div className="font-medium">Подтверждение</div>

        <div className="text-sm">
          <span className="text-muted-foreground">Action:</span> {d.selectedAction ?? '—'}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Position:</span> {d.position ?? '—'}
          {'  '}|{' '}
          <span className="text-muted-foreground">Effect:</span> {d.effect ?? '—'}
        </div>

        {d.consequence_hint ? (
          <div className="text-sm">
            <span className="text-muted-foreground">Consequence:</span> {d.consequence_hint}
          </div>
        ) : null}

        {err('accept') ? <div className="text-xs text-red-500">{err('accept')}</div> : null}

        <div className="flex gap-2">
          <button
            className="border rounded px-3 py-2 text-sm"
            onClick={() => patchStageData({ accept: true })}
            type="button"
          >
            Ок, бросаю
          </button>
          <button
            className="border rounded px-3 py-2 text-sm"
            onClick={() => patchStageData({ accept: false })}
            type="button"
          >
            Не согласен, выбрать другой action
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Выбери вариант, затем нажми Submit внизу диалога.
        </div>
      </div>
    );
  };

  // ------- roll -------
  const RollResult = () => {
    const r = envelope?.stageData ?? {};
    const rolls = Array.isArray(r.rolls) ? r.rolls : [];
    return (
      <div className="rounded border p-3 flex flex-col gap-2">
        <div className="font-medium">Результат броска</div>
        <div className="text-sm">
          <span className="text-muted-foreground">Action:</span> {r.action ?? '—'}
          {'  '}|{' '}
          <span className="text-muted-foreground">Pool:</span> {r.pool ?? 0}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Position/Effect:</span> {r.position ?? '—'} / {r.effect ?? '—'}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Rolls:</span> {rolls.length ? rolls.join(', ') : '—'}
          {'  '}|{' '}
          <span className="text-muted-foreground">Best:</span> {r.best ?? '—'}
          {'  '}|{' '}
          <span className="text-muted-foreground">Outcome:</span> {r.outcome ?? '—'}
          {r.crit ? ' (crit)' : ''}
        </div>

        <div className="text-xs text-muted-foreground">
          Этот экран read-only. Submit не нужен.
        </div>
      </div>
    );
  };

  // ------- resist -------
  const Resist = () => {
    const r = envelope?.stageData ?? {};
    const rolls = Array.isArray(r.rolls) ? r.rolls : [];
    const confirm = envelope?.stageData?.confirm_resist;

    return (
      <div className="rounded border p-3 flex flex-col gap-3">
        <div className="font-medium">Resistance</div>

        {r.attribute ? (
          <div className="text-sm">
            <span className="text-muted-foreground">Attribute:</span> {r.attribute} {' | '}
            <span className="text-muted-foreground">Pool:</span> {r.pool ?? 0}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Хочешь сопротивляться последствиям?
          </div>
        )}

        {rolls.length ? (
          <div className="text-sm">
            <span className="text-muted-foreground">Rolls:</span> {rolls.join(', ')} {' | '}
            <span className="text-muted-foreground">Stress cost:</span> {r.stressCost ?? '—'}
          </div>
        ) : null}

        {err('confirm_resist') ? <div className="text-xs text-red-500">{err('confirm_resist')}</div> : null}

        <div className="flex gap-2">
          <button
            className="border rounded px-3 py-2 text-sm"
            onClick={() => patchStageData({ confirm_resist: true })}
            type="button"
          >
            Сопротивляться
          </button>
          <button
            className="border rounded px-3 py-2 text-sm"
            onClick={() => patchStageData({ confirm_resist: false })}
            type="button"
          >
            Не сопротивляться
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Выбери вариант, затем нажми Submit внизу диалога.
        </div>
      </div>
    );
  };

  // ------- done -------
  const Done = () => (
    <div className="rounded border p-3">
      <div className="font-medium">Готово</div>
      <div className="text-sm text-muted-foreground">Действие завершено.</div>
      <div className="text-xs text-muted-foreground mt-1">
        action: {action.actionKey}
      </div>
    </div>
  );

  switch (envelope?.stageKey) {
    case 'choose_action':
      return <ChooseAction />;
    case 'gm_set_position_effect':
      return <GmSetPositionEffect />;
    case 'confirm_or_repick':
      return <ConfirmOrRepick />;
    case 'roll':
      return <RollResult />;
    case 'resist':
      return <Resist />;
    case 'done':
    default:
      return <Done />;
  }
}
