'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { MoveExpandable, toMoveDisplayData } from '../../shared/MoveCard';
import { alpha } from '../../../../../../base/ui/src/lib/pbta';

type StatOpt = { id: string; title?: string; value?: number; can_increase?: boolean; color?: string };
type SkillOpt = { id: string; title?: string; color?: string };

type MoveOpt = {
  id: string;
  title?: string;
  kind?: string;
  summary?: string;
  trigger?: string;
  effect?: string;
  effect_10_plus?: string;
  effect_7_9?: string;
  effect_6_minus?: string;
  available_stats?: string[];
  tier_badge?: string;
  requires_move_titles?: string[];
};

type CustomDraft = {
  id: string;
  title: string;
  trigger: string;
  effect: string;
  effect_10_plus: string;
  effect_7_9: string;
  effect_6_minus: string;
  available_stats: string[];
};

function newCustomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `custom_${crypto.randomUUID()}`;
  }
  return `custom_${Date.now()}`;
}

function emptyCustom(): CustomDraft {
  return {
    id: newCustomId(),
    title: '',
    trigger: '',
    effect: '',
    effect_10_plus: '',
    effect_7_9: '',
    effect_6_minus: '',
    available_stats: [],
  };
}

export default function LevelUpStage(props: ActionHandlerProps) {
  const {
    user_id,
    action,
    value,
    onChange,
    onPatch,
    onSubmit,
    setSubmitEnabled,
    stageKey: viewKeyProp,
    readOnly = false,
  } = props;

  const stageKey = String(viewKeyProp ?? action?.workflow?.stageKey ?? '');
  const stageData = action?.workflow?.stageData ?? {};
  const entry = action?.workflow?.context?.entry ?? {};
  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id);
  const isChoose = stageKey === 'level_up.choose';
  const isReview = stageKey === 'level_up.review';
  const canEdit = !readOnly && ((isChoose && !isGm) || (isReview && isGm));

  const stats: StatOpt[] = useMemo(
    () => (Array.isArray(stageData.stats) ? stageData.stats : []),
    [stageData.stats],
  );
  const skills: SkillOpt[] = useMemo(() => {
    if (Array.isArray(stageData.skills) && stageData.skills.length) return stageData.skills;
    return stats.map((s) => ({ id: s.id, title: s.title, color: s.color }));
  }, [stageData.skills, stats]);
  const moves: MoveOpt[] = useMemo(
    () => (Array.isArray(stageData.moves) ? stageData.moves : []),
    [stageData.moves],
  );

  const [statId, setStatId] = useState<string>(
    String(value?.stat_id ?? entry?.chosen_stat_id ?? ''),
  );
  const [moveId, setMoveId] = useState<string>(
    String(value?.move_id ?? entry?.chosen_move_id ?? ''),
  );
  const [useCustom, setUseCustom] = useState(Boolean(entry?.custom_move));
  const [custom, setCustom] = useState<CustomDraft>(() => {
    const cm = entry?.custom_move;
    if (cm && typeof cm === 'object') {
      return {
        id: String(cm.id || newCustomId()),
        title: String(cm.title || ''),
        trigger: String(cm.trigger || ''),
        effect: String(cm.effect || ''),
        effect_10_plus: String(cm.effect_10_plus || ''),
        effect_7_9: String(cm.effect_7_9 || ''),
        effect_6_minus: String(cm.effect_6_minus || ''),
        available_stats: Array.isArray(cm.available_stats) ? cm.available_stats.map(String) : [],
      };
    }
    return emptyCustom();
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    setStatId(String(value?.stat_id ?? entry?.chosen_stat_id ?? ''));
    setMoveId(String(value?.move_id ?? entry?.chosen_move_id ?? ''));
  }, [value?.stat_id, value?.move_id, entry?.chosen_stat_id, entry?.chosen_move_id]);

  const blockers: string[] = Array.isArray(stageData.blockers) ? stageData.blockers : [];
  const customValid = Boolean(custom.title.trim());
  const hardBlockers = blockers.filter((b) => {
    if (isGm && useCustom && customValid) {
      return !(
        b.includes('ходов') ||
        b.includes('playbook') ||
        b.toLowerCase().includes('advanced')
      );
    }
    return true;
  });

  const choiceReady =
    Boolean(statId) &&
    stageData.canLevelUp !== false &&
    hardBlockers.length === 0 &&
    (useCustom ? isGm && customValid : Boolean(moveId));

  const canSubmitChoose = canEdit && isChoose && choiceReady;
  const canSubmitReview = canEdit && isReview && choiceReady;

  useEffect(() => {
    if (isReview && isGm) setSubmitEnabled(canSubmitReview);
    else if (isChoose) setSubmitEnabled(canSubmitChoose);
    else setSubmitEnabled(false);
  }, [canSubmitChoose, canSubmitReview, isChoose, isReview, isGm, setSubmitEnabled]);

  const sync = (next: Record<string, unknown>) => {
    onChange?.(next);
    onPatch?.(next);
  };

  const pickStat = (id: string) => {
    if (!canEdit) return;
    setStatId(id);
    sync({
      stat_id: id,
      move_id: useCustom ? null : moveId || null,
      custom_move: useCustom ? custom : null,
    });
  };

  const pickMove = (id: string) => {
    if (!canEdit) return;
    setUseCustom(false);
    setMoveId(id);
    setExpandedId(id);
    sync({ stat_id: statId || null, move_id: id, custom_move: null });
  };

  const enableCustom = () => {
    if (!canEdit || !isGm) return;
    const next = custom.title ? custom : emptyCustom();
    setCustom(next);
    setUseCustom(true);
    setMoveId('');
    sync({
      stat_id: statId || null,
      move_id: null,
      custom_move: {
        id: next.id,
        title: next.title,
        trigger: next.trigger,
        effect: next.effect,
        effect_10_plus: next.effect_10_plus,
        effect_7_9: next.effect_7_9,
        effect_6_minus: next.effect_6_minus,
        available_stats: next.available_stats,
      },
    });
  };

  const patchCustom = (patch: Partial<CustomDraft>) => {
    if (!canEdit || !isGm) return;
    const next = { ...custom, ...patch };
    setCustom(next);
    setUseCustom(true);
    setMoveId('');
    sync({
      stat_id: statId || null,
      move_id: null,
      custom_move: {
        id: next.id,
        title: next.title,
        trigger: next.trigger,
        effect: next.effect,
        effect_10_plus: next.effect_10_plus,
        effect_7_9: next.effect_7_9,
        effect_6_minus: next.effect_6_minus,
        available_stats: next.available_stats,
      },
    });
  };

  const selectedStatColor = skills.find((s) => s.id === statId)?.color || '';

  const sortedMoves = useMemo(() => {
    if (!statId) return moves;
    return [...moves].sort((a, b) => {
      const am = (a.available_stats || []).includes(statId) ? 0 : 1;
      const bm = (b.available_stats || []).includes(statId) ? 0 : 1;
      return am - bm;
    });
  }, [moves, statId]);

  if (stageKey === 'level_up.result' || stageKey === 'completed') {
    return (
      <div className="rounded border p-3 flex flex-col gap-2">
        <div className="font-medium text-emerald-200">Уровень повышен</div>
        <div className="text-sm text-white/70">
          {stageData.summary || entry.summary || 'Готово'}
        </div>
        <div className="text-xs text-white/40">
          Ур. {stageData.level ?? entry.level} · XP {stageData.xp ?? entry.xp}
        </div>
      </div>
    );
  }

  const name = stageData.characterName || entry.character_name || 'Персонаж';
  const level = Number(stageData.level ?? entry.level ?? 1);
  const xp = Number(stageData.xp ?? entry.xp ?? 0);
  const cost = Number(stageData.xpCost ?? entry.xp_cost ?? level + 7);
  const nextLevel = Number(stageData.nextLevel ?? level + 1);
  const gmComment = String(stageData.gmComment || entry.gm_comment || '');

  const choicePayload = () => {
    if (useCustom && isGm) {
      return {
        stat_id: statId,
        move_id: custom.id,
        custom_move: {
          id: custom.id,
          title: custom.title.trim(),
          trigger: custom.trigger,
          effect: custom.effect,
          effect_10_plus: custom.effect_10_plus,
          effect_7_9: custom.effect_7_9,
          effect_6_minus: custom.effect_6_minus,
          available_stats: custom.available_stats,
        },
      };
    }
    return { stat_id: statId, move_id: moveId, custom_move: null };
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div>
        <div className="font-medium">
          {isReview ? 'Повышение уровня — проверка мастера' : 'Повышение уровня'}
        </div>
        <div className="text-sm text-white/60 mt-1">
          {name}: ур. {level} → {nextLevel}. Стоимость {cost} XP (сейчас {xp}).
        </div>
        {isReview && !isGm ? (
          <div className="mt-2 text-xs text-amber-200/90">
            Черновик отправлен мастеру. Ожидайте подтверждения или правок.
          </div>
        ) : null}
        {isChoose && gmComment ? (
          <div className="mt-2 text-xs text-rose-200/90">Комментарий мастера: {gmComment}</div>
        ) : null}
      </div>

      {blockers.length > 0 ? (
        <div className="rounded border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 space-y-1">
          {blockers.map((b) => (
            <div key={b}>{b}</div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-sm text-white/70">+1 к характеристике (макс. 18)</div>
        {stats.length === 0 ? (
          <div className="text-xs text-white/40">Нет характеристик</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.map((s) => {
              const disabled = !canEdit || !s.can_increase;
              const selected = statId === s.id;
              const color = s.color || '';
              const style = color
                ? {
                    borderColor: alpha(color, selected ? 0.85 : 0.55) ?? undefined,
                    backgroundColor: alpha(color, selected ? 0.28 : 0.12) ?? undefined,
                    boxShadow: selected ? `0 0 0 1px ${alpha(color, 0.45)}` : undefined,
                  }
                : undefined;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickStat(s.id)}
                  style={style}
                  className={[
                    'rounded border px-2 py-2 text-left text-sm transition-colors',
                    color
                      ? 'text-white/90'
                      : selected
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                        : 'border-white/10 bg-zinc-950/40 text-white/80 hover:border-white/25',
                    disabled ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <div className="font-medium" style={color ? { color } : undefined}>
                    {s.title || s.id}
                  </div>
                  <div className="text-xs text-white/50">
                    {s.value ?? '—'}
                    {s.can_increase ? ' → +1' : ' (макс.)'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-white/70">Новый ход класса</div>
          {isGm && canEdit ? (
            <button
              type="button"
              onClick={enableCustom}
              className={[
                'text-xs px-2 py-1 rounded border',
                useCustom
                  ? 'border-amber-500/70 bg-amber-950/40 text-amber-100'
                  : 'border-amber-700/50 bg-amber-950/20 text-amber-200 hover:border-amber-500',
              ].join(' ')}
            >
              {useCustom ? 'Кастомный ход (выбран)' : '+ Кастомный ход'}
            </button>
          ) : null}
        </div>

        {sortedMoves.length === 0 && !useCustom ? (
          <div className="text-xs text-white/40">Нет доступных ходов</div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {sortedMoves.map((m) => {
              const selected = !useCustom && moveId === m.id;
              const matchesStat = Boolean(statId) && (m.available_stats || []).includes(statId);
              const req = (m.requires_move_titles || []).filter(Boolean);
              const ringStyle =
                matchesStat && selectedStatColor
                  ? {
                      boxShadow: `0 0 0 1px ${alpha(selectedStatColor, selected ? 0.9 : 0.55)}`,
                      backgroundColor: alpha(selectedStatColor, selected ? 0.18 : 0.08) ?? undefined,
                    }
                  : undefined;
              return (
                <div key={m.id} className="space-y-1 rounded" style={ringStyle}>
                  <MoveExpandable
                    move={toMoveDisplayData(m)}
                    checked={selected}
                    highlighted={selected || matchesStat}
                    disabled={!canEdit}
                    tierBadge={m.tier_badge}
                    skills={skills as Array<{ id: string; title: string; color: string }>}
                    defaultExpanded={false}
                    expanded={expandedId === m.id}
                    onExpandedChange={(open) => setExpandedId(open ? m.id : null)}
                    onToggle={
                      !canEdit
                        ? undefined
                        : (c) => {
                            if (c) pickMove(m.id);
                            else {
                              setMoveId('');
                              sync({ stat_id: statId || null, move_id: null, custom_move: null });
                            }
                          }
                    }
                  />
                  {req.length > 0 && expandedId === m.id ? (
                    <div className="text-[11px] text-amber-200/80 px-2 pb-1">
                      Требует ход: {req.join(', ')}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isGm && useCustom && canEdit ? (
        <div className="rounded border border-amber-800/50 bg-amber-950/20 p-3 space-y-2">
          <div className="text-sm text-amber-100">Кастомный ход от мастера</div>
          <input
            className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
            placeholder="Название"
            value={custom.title}
            onChange={(e) => patchCustom({ title: e.target.value })}
          />
          <textarea
            className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white resize-y min-h-[2.5rem]"
            placeholder="Когда… (триггер)"
            rows={2}
            value={custom.trigger}
            onChange={(e) => patchCustom({ trigger: e.target.value })}
          />
          <textarea
            className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white resize-y min-h-[2.5rem]"
            placeholder="Эффект"
            rows={2}
            value={custom.effect}
            onChange={(e) => patchCustom({ effect: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                ['effect_10_plus', '10+'],
                ['effect_7_9', '7–9'],
                ['effect_6_minus', '6−'],
              ] as const
            ).map(([key, label]) => (
              <textarea
                key={key}
                className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white resize-y min-h-[2.5rem]"
                placeholder={label}
                rows={2}
                value={custom[key]}
                onChange={(e) => patchCustom({ [key]: e.target.value })}
              />
            ))}
          </div>
          {custom.title.trim() ? (
            <MoveExpandable
              move={toMoveDisplayData({
                id: custom.id,
                title: custom.title,
                kind: 'custom',
                trigger: custom.trigger,
                effect: custom.effect,
                effect_10_plus: custom.effect_10_plus,
                effect_7_9: custom.effect_7_9,
                effect_6_minus: custom.effect_6_minus,
                available_stats: custom.available_stats,
              })}
              checked
              highlighted
              tierBadge="кастом"
              skills={skills as Array<{ id: string; title: string; color: string }>}
              defaultExpanded
            />
          ) : null}
        </div>
      ) : null}

      {isChoose && canEdit ? (
        <button
          type="button"
          disabled={!canSubmitChoose}
          className="rounded border border-sky-400/50 px-3 py-2 text-sm text-sky-100 disabled:opacity-40"
          onClick={() => onSubmit(choicePayload())}
        >
          Отправить мастеру
        </button>
      ) : null}

      {isReview && isGm && canEdit ? (
        <div className="flex flex-col gap-2">
          <input
            className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
            placeholder="Комментарий (при возврате)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canSubmitReview}
              className="rounded border border-emerald-400/50 px-3 py-2 text-sm text-emerald-200 disabled:opacity-40"
              onClick={() =>
                onSubmit({
                  ...choicePayload(),
                  decision: 'approve',
                  comment,
                })
              }
            >
              Подтвердить уровень
            </button>
            <button
              type="button"
              className="rounded border border-rose-400/40 px-3 py-2 text-sm text-rose-200"
              onClick={() =>
                onSubmit({
                  decision: 'reject',
                  comment,
                  ...choicePayload(),
                })
              }
            >
              Вернуть игроку
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
