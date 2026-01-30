'use client';

import React, { useMemo } from 'react';
import type { ActionId, AttributeId } from '../../../types';
import { ACTION_GROUPS } from '../../../types';
import { ACTION_RU, ATTR_RU } from '../../../i18n';

function normId(x: any): string {
  return String(x ?? '').trim().toLowerCase();
}

function groupOfAttr(attr: AttributeId) {
  return ACTION_GROUPS.find((g) => g.key === attr);
}

function actionsOfAttr(attr: AttributeId): readonly ActionId[] {
  return groupOfAttr(attr)?.actions ?? [];
}

function colorOfAttr(attr: AttributeId): string {
  return groupOfAttr(attr)?.color ?? '#a1a1aa';
}

function ratingFromActions(
  actionRatings: Partial<Record<ActionId, number>> | null | undefined,
  actions: readonly ActionId[]
): number {
  let cnt = 0;
  for (const a of actions) {
    const n = Number(actionRatings?.[a] ?? 0);
    if (Number.isFinite(n) && n > 0) cnt += 1;
  }
  return cnt;
}

function safeNum(x: any): number {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function ResistStage({ action, value, patch }: { action: any; value: any; patch: (p: any) => void }) {
  const wf: any = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const done = !!ctx?.resist;
  const scene = (action?.scene ?? null) as any; // NEW

  const attrs: AttributeId[] = (wf?.ui?.props?.attributes ?? ['insight', 'prowess', 'resolve']) as AttributeId[];
  const attr: AttributeId = (value?.attribute ?? attrs[0]) as AttributeId;

  // Найдём персонажа по character_id из контекста
  const character = useMemo(() => {
    const characterId = ctx?.character_id || ctx?.roll?.character_id;
    if (!scene || !characterId) return null;

    const players = scene.players ?? {};
    for (const entry of Object.values(players)) {
      const chars = (entry as any)?.characters ?? [];
      for (const ch of chars) {
        if (normId(ch?.id) === normId(characterId)) return ch;
      }
    }
    return null;
  }, [ctx?.scene, ctx?.character_id, ctx?.roll?.character_id]);

  const actionRatings: Partial<Record<ActionId, number>> | null = (character?.data?.actions ?? null) as any;

  const attrActions = useMemo(() => actionsOfAttr(attr), [attr]);
  const attrRating = useMemo(() => ratingFromActions(actionRatings, attrActions), [actionRatings, attrActions]);

  const isConfirm = value?.confirm === true;
  const isSkip = value?.confirm === false;

  const confirmStyle: React.CSSProperties = isConfirm
    ? { outline: '4px solid #34d399', outlineOffset: 2, background: 'rgba(16,185,129,0.22)', borderColor: '#34d399' }
    : { outline: '0px solid transparent' };

  const skipStyle: React.CSSProperties = isSkip
    ? { outline: '4px solid #f87171', outlineOffset: 2, background: 'rgba(239,68,68,0.18)', borderColor: '#f87171' }
    : { outline: '0px solid transparent' };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Сопротивление (GM)</div>

      {character ? (
        <div className="rounded border px-3 py-2 bg-zinc-950/30">
          <div className="text-sm">
            <span className="text-muted-foreground">Персонаж:</span> {character.name ?? character.id}
          </div>
          <div className="text-xs text-muted-foreground">
            Выбранный атрибут: <span style={{ color: colorOfAttr(attr) }}>{ATTR_RU[attr] ?? attr}</span> · рейтинг:{' '}
            <span className="text-white font-semibold">{attrRating}d</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-red-500">
          Не нашёл персонажа в ctx.scene по character_id (нужно передать ctx.scene и ctx.character_id).
        </div>
      )}

      {!done ? (
        <>
          <div className="text-sm text-muted-foreground">Выбери атрибут для сопротивления (по природе последствия).</div>

          {/* Карточки атрибутов */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {attrs.map((a) => {
              const selected = a === attr;
              const color = colorOfAttr(a);
              const actions = actionsOfAttr(a);
              const rating = ratingFromActions(actionRatings, actions);

              const style: React.CSSProperties = selected
                ? { outline: `4px solid ${color}`, outlineOffset: 2, borderColor: color, background: 'rgba(255,255,255,0.04)' }
                : { borderColor: 'rgba(161,161,170,0.35)' };

              return (
                <button
                  key={a}
                  type="button"
                  className="text-left border rounded px-3 py-2 transition-colors hover:bg-zinc-900/30"
                  style={style}
                  onClick={() => patch({ attribute: a })}
                  aria-pressed={selected}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold" style={{ color }}>
                      {ATTR_RU[a] ?? a}
                    </div>
                    <div className="text-sm font-bold text-white">{rating}d</div>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {actions.map((x) => `${ACTION_RU[x] ?? x}:${safeNum(actionRatings?.[x])}`).join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Кнопки решения */}
          <div className="flex flex-row gap-2">
            <button
              type="button"
              className="border-2 rounded px-3 py-2 text-sm font-semibold text-white flex-1"
              style={confirmStyle}
              onClick={() => patch({ confirm: true })}
            >
              Кинуть сопротивление ({attrRating}d)
            </button>

            <button
              type="button"
              className="border-2 rounded px-3 py-2 text-sm font-semibold text-white flex-1"
              style={skipStyle}
              onClick={() => patch({ confirm: false })}
            >
              Пропустить
            </button>
          </div>
        </>
      ) : (
        <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm">
          <div>
            <span className="text-muted-foreground">Атрибут:</span>{' '}
            <span style={{ color: colorOfAttr(ctx.resist.attribute as AttributeId) }}>
              {ATTR_RU[(ctx.resist.attribute as AttributeId) ?? 'insight'] ?? String(ctx.resist.attribute)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Кубики:</span>{' '}
            {Array.isArray(ctx.resist.rolls) ? ctx.resist.rolls.join(', ') : '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Стоимость стресса:</span> {ctx.resist.stressCost}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">Submit: {'{ attribute, confirm }'}.</div>
    </div>
  );
}
