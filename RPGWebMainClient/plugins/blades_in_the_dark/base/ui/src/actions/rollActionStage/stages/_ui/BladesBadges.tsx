'use client';

import React from 'react';
import { ACTION_RU, POSITION_RU, EFFECT_RU, ATTR_RU, groupOfAction } from '../../../../i18n';
import type { ActionId } from '../../../../types';

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

const ITEM_COLOR = '#a78bfa';

export function Badge({ text, color, title }: { text: string; color: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border"
      style={{ borderColor: color, color }}
    >
      <span className="inline-block w-2 h-2 rounded" style={{ background: color }} />
      {text}
    </span>
  );
}

function safeNum(x: any): number {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getMods(ctx: any): any {
  return ctx?.mods ?? {};
}

/**
 * Ищем предмет НЕ в ctx.scene (его нет), а в action.scene.items (ты обогащаешь action на бэке).
 * При этом поддерживаем старые варианты, если где-то всё-таки прокинули items в ctx.
 */
function findSelectedItem(ctx: any, action: any | null): any | null {
  const mods = getMods(ctx);

  const itemId = mods?.item_id ?? mods?.itemId ?? ctx?.item_id ?? null;
  if (!itemId) return null;

  const items: any[] =
    (action?.scene?.items ?? null) ||
    (ctx?.items ?? null) ||
    (ctx?.scene?.items ?? null) ||
    [];

  if (!Array.isArray(items) || items.length === 0) return { id: itemId };

  return items.find((it) => String(it?.id) === String(itemId)) ?? { id: itemId };
}

function itemQuality(item: any): number {
  const q = safeNum(item?.quality) || safeNum(item?.data?.quality) || safeNum(item?.data?.tier) || 0;
  return Math.max(0, Math.trunc(q));
}

function Delta({ label, delta, title, color }: { label: string; delta: number; title: string; color: string }) {
  const sign = delta > 0 ? '+' : '';
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span title={title} className="font-semibold" style={{ color }}>
        {sign}
        {delta}
      </span>
    </span>
  );
}

/**
 * NEW API:
 * - передаёшь wf и action (опционально)
 * - он сам берёт ctx = wf.context и рисует summary
 */
export function ActionPositionEffectLine({ action }: { action: any }) {
  const wf: any = action?.workflow ?? {};
  const ctx = wf?.context ?? {};

  const actionId = (ctx?.selectedAction ?? '') as ActionId;
  const g = actionId ? groupOfAction(actionId) : undefined;

  const actionLabel = actionId ? (ACTION_RU as any)[actionId] ?? actionId : '—';
  const groupLabel = g ? (ATTR_RU as any)[g.key] ?? g.key : null;
  const actionColor = g?.color ?? '#a1a1aa';

  const posId = String(ctx?.position ?? '');
  const effId = String(ctx?.effect ?? '');

  const posLabel = posId ? (POSITION_RU as any)[posId] ?? posId : '—';
  const effLabel = effId ? (EFFECT_RU as any)[effId] ?? effId : '—';

  const posColor = POSITION_COLORS[posId] ?? '#a1a1aa';
  const effColor = EFFECT_COLORS[effId] ?? '#a1a1aa';

  const roll = ctx?.roll ?? null;
  const mods = getMods(ctx);

  // Пул: считаем только дайсовые моды
  const base = safeNum(roll?.base ?? ctx?.base);
  const push = mods?.push ? 1 : 0;

  // важно: help у тебя на бэке учитывается только если help_confirmed
  const help = mods?.help && mods?.help_confirmed ? 1 : 0;

  const bargain = mods?.devils_bargain ? 1 : 0;
  const bonusDice = safeNum(mods?.bonus_dice ?? ctx?.bonus_dice);

  const computedPool = base + push + help + bargain + bonusDice;
  const pool = roll ? safeNum(roll.pool) : computedPool;

  const showPoolLine = Number.isFinite(pool) && (base || push || help || bargain || bonusDice || roll?.pool != null);

  const item = findSelectedItem(ctx, action ?? null);
  const q = item ? itemQuality(item) : 0;
  const itemLabel = item ? (item?.name ? String(item.name) : `item:${String(item.id ?? '')}`) : null;
  const itemTitle = item
    ? `Используется предмет: ${itemLabel}. Quality=${q}. Качество/тир обычно влияет на effect (не на дайсы).`
    : undefined;

  return (
    <>
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="text-muted-foreground">Действие:</span>
        <Badge text={actionLabel} color={actionColor} title={actionId || undefined} />
        {groupLabel ? (
          <span className="text-xs text-muted-foreground">
            (<span style={{ color: actionColor }}>{groupLabel}</span>)
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="text-muted-foreground">Позиция:</span>
        <Badge text={posLabel} color={posColor} title={posId || undefined} />

        <span className="text-muted-foreground">| Эффект:</span>
        <Badge text={effLabel} color={effColor} title={effId || undefined} />
      </div>

      {itemLabel ? (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-muted-foreground">Предмет:</span>
          <Badge text={`${itemLabel} (Q${q})`} color={ITEM_COLOR} title={itemTitle} />
        </div>
      ) : null}

      {showPoolLine ? (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">Пул:</span>
          <span className="font-semibold text-white">{pool}</span>

          <Delta label="Рейтинг" delta={base} title="Базовый рейтинг действия выбранного персонажа." color="#e5e7eb" />
          {push ? <Delta label="Push" delta={1} title="Push yourself: +1d (обычно стресс +2)." color="#34d399" /> : null}
          {help ? <Delta label="Help" delta={1} title="Помощь союзника: +1d (только если подтверждена)." color="#60a5fa" /> : null}
          {bargain ? <Delta label="Bargain" delta={1} title="Сделка с дьяволом: +1d." color="#f472b6" /> : null}
          {bonusDice ? <Delta label="Bonus" delta={bonusDice} title="Доп. бонус-дайсы (bonus_dice)." color="#facc15" /> : null}
        </div>
      ) : null}

      {ctx?.consequence_hint ? (
        <div className="text-sm">
          <span className="text-muted-foreground">Последствие:</span> {ctx.consequence_hint}
        </div>
      ) : null}
    </>
  );
}
