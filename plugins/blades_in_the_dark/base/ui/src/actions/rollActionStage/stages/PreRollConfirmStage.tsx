'use client';

import { useMemo } from 'react';

import { ACTION_RU, POSITION_RU, EFFECT_RU, ATTR_RU, groupOfAction } from '../../../i18n';
import type { ActionId } from '../../../types';

const POSITION_COLORS: Record<string, string> = {
  controlled: '#22c55e',
  risky: '#eab308',
  desperate: '#ef4444',
};

const EFFECT_COLORS: Record<string, string> = {
  limited: '#ef4444',
  standard: '#eab308',
  great: '#22c55e',
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border"
      style={{ borderColor: color, color }}
    >
      <span className="inline-block w-2 h-2 rounded" style={{ background: color }} />
      {text}
    </span>
  );
}

export function PreRollConfirmStage({
  wf,
  value,
  patch,
  user_id,
  action,
}: {
  wf: any;
  value: any;
  patch: (p: any) => void;
  user_id: string;
  action: any;
}) {
  const ctx = wf?.context ?? {};

  const actionId = String(ctx.selectedAction ?? '') as ActionId;
  const g = actionId ? groupOfAction(actionId) : undefined;
  const actionLabel = actionId ? (ACTION_RU as any)[actionId] ?? actionId : '—';
  const groupLabel = g ? ATTR_RU[g.key] : null;
  const actionColor = g?.color ?? '#a1a1aa';

  const posId = String(ctx.position ?? '');
  const effId = String(ctx.effect ?? '');
  const posLabel = posId ? POSITION_RU[posId] ?? posId : '—';
  const effLabel = effId ? EFFECT_RU[effId] ?? effId : '—';
  const posColor = POSITION_COLORS[posId] ?? '#a1a1aa';
  const effColor = EFFECT_COLORS[effId] ?? '#a1a1aa';

  const base = useMemo(() => {
    const scene = action?.scene;
    const characterId = value?.character_id || ctx.character_id;
    if (!scene || !characterId || !actionId) return 0;

    const players = scene.players ?? {};
    for (const [, entry] of Object.entries(players)) {
      for (const ch of (entry as any).characters ?? []) {
        if (String(ch.id) === String(characterId)) {
          const v = (ch.data?.actions ?? {})[actionId];
          const n = Number(v ?? 0);
          return Number.isFinite(n) ? n : 0;
        }
      }
    }
    return 0;
  }, [action?.scene, value?.character_id, ctx.character_id, actionId]);

  const mods = ctx.mods ?? {};
  const autoBonus =
    (mods?.push ? 1 : 0) +
    (mods?.devils_bargain ? 1 : 0) +
    (mods?.help && mods?.help_confirmed ? 1 : 0) +
    Number(mods?.bonus_dice ?? 0);

  const pool = base + autoBonus;

  const accept = typeof value?.accept === 'boolean' ? value.accept : true;

  const btnBase =
    'border rounded px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0';

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Перед броском</div>

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted-foreground">Действие:</span>
        <Badge text={actionLabel} color={actionColor} />
        {groupLabel ? <span className="text-xs text-muted-foreground">{groupLabel}</span> : null}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted-foreground">Риск:</span>
        <Badge text={posLabel} color={posColor} />
        <span className="text-muted-foreground">Эффект:</span>
        <Badge text={effLabel} color={effColor} />
      </div>

      {ctx.consequence_hint ? (
        <div className="rounded border border-zinc-700 bg-zinc-950/40 p-2 text-sm">
          <span className="text-muted-foreground">Возможные последствия:</span> {ctx.consequence_hint}
        </div>
      ) : null}

      <div className="rounded border border-zinc-700 bg-zinc-950/40 p-2 text-xs text-muted-foreground">
        push={String(!!mods.push)} · help={String(!!mods.help)} · help_confirmed={String(!!mods.help_confirmed)} ·
        bargain={String(!!mods.devils_bargain)} · bonus_dice={String(mods.bonus_dice ?? 0)}
      </div>

      <div className="text-sm">
        <span className="text-muted-foreground">Рейтинг:</span> {base} ·{' '}
        <span className="text-muted-foreground">Бонус:</span> {autoBonus} ·{' '}
        <span className="text-muted-foreground">Пул:</span> <span className="font-medium">{pool}</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          aria-pressed={accept === true}
          className={`${btnBase} ${
            accept === true
              ? 'bg-green-600 text-white border-green-500 hover:bg-green-500 focus:ring-green-500'
              : 'bg-transparent text-gray-200 border-zinc-600 hover:bg-zinc-800 focus:ring-zinc-500'
          }`}
          onClick={() => patch({ accept: true })}
        >
          Бросаем
        </button>

        <button
          type="button"
          aria-pressed={accept === false}
          className={`${btnBase} ${
            accept === false
              ? 'bg-red-600 text-white border-red-500 hover:bg-red-500 focus:ring-red-500'
              : 'bg-transparent text-gray-200 border-zinc-600 hover:bg-zinc-800 focus:ring-zinc-500'
          }`}
          onClick={() => patch({ accept: false })}
        >
          Назад к выбору
        </button>
      </div>

      <div className="text-xs text-muted-foreground">Submit отправит: {'{ accept }'}.</div>
    </div>
  );
}
