'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';

type DraftItem = {
  id: string;
  spell_id?: string;
  prepared?: boolean;
  amount?: number;
  title?: string;
  level?: number;
  school?: string;
  description?: string;
  tags?: string[];
  is_cantrip?: boolean;
};

function levelLabel(level: number): string {
  if (level <= 0) return 'фокус / 0';
  return `${level} ур.`;
}

function isCantrip(s: DraftItem): boolean {
  if (s.is_cantrip) return true;
  return String(s.school || '') === 'фокус';
}

/** Budget uses spell level once (amount ignored). Cantrips cost 0. */
function budgetCost(s: DraftItem): number {
  if (!s.prepared) return 0;
  if (isCantrip(s)) return 0;
  const level = Number(s.level || 0);
  return level > 0 ? level : 0;
}

export default function PrepareSpellsStage(props: ActionHandlerProps) {
  const {
    action,
    user_id,
    value,
    onChange,
    onPatch,
    onSubmit,
    setSubmitEnabled,
    stageKey: viewKeyProp,
    readOnly = false,
  } = props;

  const stageKey = String(viewKeyProp ?? action?.workflow?.stageKey ?? '');
  const gmId = String(action?.participants?.gmUserId ?? '');
  const myId = String(user_id ?? action?.current_user_id ?? '');
  const isGm = myId && myId === gmId;
  const entry = action?.workflow?.context?.entry ?? {};
  const stageData = action?.workflow?.stageData ?? {};
  const budget = Number(stageData.levelBudget ?? 0);
  const cantripNote = String(stageData.cantripNote || '');
  const cantripOwned = Number(stageData.cantripOwned ?? 0);
  const cantripInCodex = Number(stageData.cantripInCodex ?? 0);

  const initialDraft: DraftItem[] = useMemo(() => {
    const raw = Array.isArray(value?.prepared_draft)
      ? value.prepared_draft
      : Array.isArray(entry?.prepared_draft)
        ? entry.prepared_draft
        : [];
    // Normalize: amount unused for prepare; cantrips always prepared by default.
    return raw.map((s: DraftItem) => {
      const cantrip = isCantrip(s);
      return {
        ...s,
        amount: 1,
        prepared: cantrip ? true : Boolean(s.prepared),
      };
    });
  }, [value?.prepared_draft, entry?.prepared_draft]);

  const [draft, setDraft] = useState<DraftItem[]>(initialDraft);
  const [comment, setComment] = useState('');
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | 'all' | 'cantrip'>('all');
  const [onlyPrepared, setOnlyPrepared] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    setSubmitEnabled(true);
  }, [setSubmitEnabled]);

  const used = draft.reduce((sum, s) => sum + budgetCost(s), 0);

  const levelsAvailable = useMemo(() => {
    const set = new Set<number>();
    for (const s of draft) set.add(Number(s.level ?? 0));
    return [...set].sort((a, b) => a - b);
  }, [draft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return draft.filter((s) => {
      if (onlyPrepared && !s.prepared) return false;
      if (levelFilter === 'cantrip' && !isCantrip(s)) return false;
      if (typeof levelFilter === 'number' && Number(s.level ?? 0) !== levelFilter) return false;
      if (q) {
        const hay = `${s.title || ''} ${s.description || ''} ${s.school || ''} ${(s.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [draft, query, levelFilter, onlyPrepared]);

  const sync = (next: DraftItem[]) => {
    setDraft(next);
    const payload = { prepared_draft: next };
    onChange?.(payload);
    onPatch?.(payload);
  };

  const togglePrepared = (id: string) => {
    if (readOnly) return;
    sync(
      draft.map((s) => {
        if (s.id !== id) return s;
        const nextPrepared = !s.prepared;
        return { ...s, prepared: nextPrepared, amount: 1 };
      }),
    );
  };

  const chip = (active: boolean) =>
    [
      'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
      active
        ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
        : 'border-white/10 bg-black/30 text-white/55 hover:border-white/25',
    ].join(' ');

  const spellCard = (s: DraftItem, canEdit: boolean) => {
    const prepared = !!s.prepared;
    const open = expandedId === s.id;
    const cantrip = isCantrip(s);
    return (
      <div
        key={s.id}
        className={[
          'rounded-lg border transition-colors',
          prepared
            ? 'border-violet-400/40 bg-violet-950/25'
            : 'border-white/10 bg-zinc-950/40',
        ].join(' ')}
      >
        <button
          type="button"
          disabled={!canEdit}
          className="w-full text-left px-3 py-2.5 disabled:cursor-default"
          onClick={() => {
            if (!canEdit) {
              setExpandedId(open ? null : s.id);
              return;
            }
            togglePrepared(s.id);
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm text-white/90 font-medium">
                {prepared ? '✓ ' : ''}
                {s.title || s.id}
              </div>
              <div className="mt-0.5 text-[10px] text-white/45">
                {cantrip ? 'фокус' : levelLabel(Number(s.level ?? 0))}
                {s.school && s.school !== 'фокус' ? ` · ${s.school}` : ''}
                {cantrip ? ' · вне бюджета' : prepared ? ` · +${Number(s.level || 0)} к сумме` : ''}
              </div>
            </div>
            <span
              className={[
                'shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border',
                prepared
                  ? 'border-violet-400/40 text-violet-100'
                  : 'border-white/15 text-white/40',
              ].join(' ')}
            >
              {prepared ? 'готово' : 'нет'}
            </span>
          </div>
          {s.description ? (
            <div className={`mt-1.5 text-xs text-white/55 whitespace-pre-line ${open ? '' : 'line-clamp-2'}`}>
              {s.description}
            </div>
          ) : null}
        </button>
        {s.description ? (
          <div className="px-3 pb-2">
            <button
              type="button"
              className="text-[10px] text-white/40 hover:text-white/70"
              onClick={() => setExpandedId(open ? null : s.id)}
            >
              {open ? 'Свернуть описание' : 'Показать описание'}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const filtersBar = (
    <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-2.5 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="flex-1 min-w-[10rem] rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-white/35"
          placeholder="Поиск…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-white/55 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyPrepared}
            onChange={(e) => setOnlyPrepared(e.target.checked)}
            className="accent-violet-500"
          />
          только подготовленные
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(levelFilter === 'all')} onClick={() => setLevelFilter('all')}>
          Все
        </button>
        <button
          type="button"
          className={chip(levelFilter === 'cantrip')}
          onClick={() => setLevelFilter('cantrip')}
        >
          Фокусы
        </button>
        {levelsAvailable
          .filter((l) => l > 0)
          .map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={chip(levelFilter === lvl)}
              onClick={() => setLevelFilter(lvl)}
            >
              {lvl} ур.
            </button>
          ))}
      </div>
    </div>
  );

  if (stageKey === 'prepare_spells.review') {
    return (
      <div className="rounded border p-3 flex flex-col gap-3">
        <div className="font-medium">Проверка подготовки</div>
        <div className="text-sm text-white/60">
          {entry.character_name || stageData.characterName || 'Персонаж'} · Σ уровней {used}
          {budget ? ` / ${budget}` : ''}
          {used > budget ? ' (сверх бюджета — soft)' : ''}
        </div>
        {(cantripNote || cantripOwned > 0) && (
          <div className="text-[11px] text-amber-100/80 rounded border border-amber-500/30 bg-amber-950/20 px-2.5 py-2">
            {cantripNote || 'Фокусы не входят в бюджет.'}
            {cantripOwned > 0 ? ` У персонажа фокусов: ${cantripOwned}.` : ''}
            {cantripInCodex > 0 ? ` В кодексе класса: ${cantripInCodex}.` : ''}
          </div>
        )}
        {filtersBar}
        <div className="space-y-2 max-h-[min(55vh,28rem)] overflow-y-auto">
          {filtered.map((s) => spellCard(s, isGm && !readOnly))}
        </div>
        {isGm && !readOnly && (
          <>
            <input
              className="rounded border bg-zinc-950/40 px-2 py-1 text-sm"
              placeholder="Комментарий (при отклонении)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-emerald-400/50 px-3 py-2 text-sm text-emerald-200"
                onClick={() => onSubmit({ decision: 'approve', prepared_draft: draft, comment })}
              >
                Approve
              </button>
              <button
                type="button"
                className="rounded border border-red-400/40 px-3 py-2 text-sm text-red-200"
                onClick={() => onSubmit({ decision: 'reject', comment })}
              >
                Reject
              </button>
            </div>
          </>
        )}
        {!isGm && (
          <div className="text-sm text-white/50">Ожидание подтверждения мастера…</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Подготовка заклинаний</div>
      <div className="text-sm text-white/60">
        Клик по карточке — подготовить / снять. Сумма уровней: {used}
        {budget ? ` / ${budget}` : ''}
        {used > budget ? ' — больше бюджета (мастер решит)' : ''}
      </div>
      <div className="text-[11px] text-amber-100/85 rounded border border-amber-500/30 bg-amber-950/20 px-2.5 py-2 space-y-1">
        <div>
          {cantripNote ||
            'Фокусы готовятся при каждой подготовке и не учитываются в сумме уровней (бюджет = уровень + 1).'}
        </div>
        <div className="text-amber-100/60">
          По умолчанию все фокусы уже подготовлены.
          {cantripOwned > 0 ? ` Сейчас: ${cantripOwned}.` : ''}
          {cantripInCodex > 0 ? ` В кодексе класса: ${cantripInCodex}.` : ''}
        </div>
      </div>
      {filtersBar}
      <div className="space-y-2 max-h-[min(55vh,28rem)] overflow-y-auto">
        {filtered.map((s) => spellCard(s, !readOnly))}
      </div>
      {!draft.length && (
        <div className="text-sm text-white/40">
          У персонажа нет заклинаний в списке — добавьте в редакторе («+ вся книга класса»).
        </div>
      )}
      {!readOnly && (
        <button
          type="button"
          className="rounded border border-violet-400/50 px-3 py-2 text-sm text-violet-100 self-start"
          onClick={() => onSubmit({ prepared_draft: draft })}
        >
          На проверку мастеру
        </button>
      )}
    </div>
  );
}
