'use client';

import { useMemo } from 'react';
import { ACTION_RU, POSITION_RU, EFFECT_RU, ATTR_RU, groupOfAction } from '../../../i18n';
import type { ActionId } from '../../../types';
import { ActionSummaryCarousel } from './_ui/ActionSummaryCarousel';

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
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border" style={{ borderColor: color, color }}>
      <span className="inline-block w-2 h-2 rounded" style={{ background: color }} />
      {text}
    </span>
  );
}

function normId(x: any): string {
  return String(x ?? '').trim().toLowerCase();
}

export function PlayerAddModsStage({
  action,
  value,
  patch,
  user_id,
}: {
  action: any;
  value: any;
  patch: (p: any) => void;
  user_id: string;
}) {
  const wf: any = action?.workflow ?? {};
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

  // ---- base rating from selected character
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

  // ---- auto bonus dice
  const autoBonus = (value?.push ? 1 : 0) + (value?.devils_bargain ? 1 : 0) + (value?.help ? 1 : 0);
  const pool = base + autoBonus;

  const setPush = (v: boolean) => {
    // взаимоисключение push и bargain
    patch({ push: v, ...(v ? { devils_bargain: false } : null) });
  };

  const setBargain = (v: boolean) => {
    patch({ devils_bargain: v, ...(v ? { push: false } : null) });
  };

  const setHelp = (v: boolean) => {
    patch({ help: v, ...(v ? null : { helper_user_id: null }) });
  };

  const helpCandidates = useMemo(() => {
    const scene = action?.scene;
    const players = scene?.players ?? {};
    const out: Array<{ userId: string; characterId: string | null; label: string }> = [];

    for (const [uid, entry] of Object.entries(players)) {
      if (normId(uid) === normId(user_id)) continue;

      const chars = Array.isArray((entry as any)?.characters) ? (entry as any).characters : [];
      // если у игрока несколько персонажей — бери первого; либо можно сделать несколько option (см. ниже)
      const ch0 = chars[0] ?? null;

      const chName = ch0?.name ? String(ch0.name) : null;
      const user = (entry as any)?.user;
      const userLabel = user?.full_name || user?.email || uid;

      out.push({
        userId: uid,
        characterId: ch0?.id ? String(ch0.id) : null,
        label: chName ? chName : userLabel,
      });
    }

    // чтобы было стабильно: сортируем по label
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [action?.scene, user_id]);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Модификаторы</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30">
        <ActionSummaryCarousel action={action} />
      </div>

      {ctx.consequence_hint ? (
        <div className="text-sm">
          <span className="text-muted-foreground">Последствие:</span> {ctx.consequence_hint}
        </div>
      ) : null}

      <div className="text-sm">
        <span className="text-muted-foreground">Рейтинг:</span> {base} ·{' '}
        <span className="text-muted-foreground">Бонус кубы:</span> {autoBonus} ·{' '}
        <span className="text-muted-foreground">Итого пул:</span> {pool}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value?.push} onChange={(e) => setPush(e.target.checked)} />
        Push yourself (+1d, стресс +2)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value?.devils_bargain} onChange={(e) => setBargain(e.target.checked)} />
        Сделка с дьяволом (+1d)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value?.help} onChange={(e) => setHelp(e.target.checked)} />
        Помощь союзника (+1d)
      </label>

      {value?.help ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Кто помогает:</span>
          <select
            className="border rounded px-2 py-1 text-black bg-background"
            value={value?.helper_user_id ?? ''}
            onChange={(e) => {
              const uid = e.target.value || null;
              const picked = helpCandidates.find((x) => x.userId === uid) ?? null;

              patch({
                helper_user_id: uid,
                // опционально: если захочешь на беке/в workflow хранить явно
                helper_character_id: picked?.characterId ?? null,
              });
            }}
          >
            <option value="" disabled>
              Выбери игрока
            </option>

            {helpCandidates.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* bonus_dice отправляем как число, но руками не редактируем — оно авто */}
      <div className="text-xs text-muted-foreground">
        Submit отправит: {'{ push, help, helper_user_id, devils_bargain, bonus_dice }'} где bonus_dice={autoBonus}.
      </div>

      {/* важно: реально записать bonus_dice в draft */}
      <AutoSyncBonusDice value={value} patch={patch} autoBonus={autoBonus} />
    </div>
  );
}

function AutoSyncBonusDice({ value, patch, autoBonus }: { value: any; patch: (p: any) => void; autoBonus: number }) {
  // небольшая “синхронизация” без эффектов в главном компоненте
  // (можно и useEffect, но так меньше шума)
  if (Number(value?.bonus_dice ?? 0) !== autoBonus) {
    queueMicrotask(() => patch({ bonus_dice: autoBonus }));
  }
  return null;
}
