'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Plus, Minus } from 'lucide-react';
import { getSceneBundle } from 'plugins/common/types/actionSelectors';
import {
  parseMovesFromStageData,
  getActorName,
  getTargetName,
  asNum,
  type MoveLite,
  type SkillConfig,
  type PerformMoveAction,
  type PerformMoveEntry,
} from '../../../../../../../base/ui/src/actions/perform_move/types';
import { MoveCard } from '../../../../../../../base/ui/src/actions/perform_move/components/MoveCard';
import { statScoresForMove } from '../../../../../../../base/ui/src/lib/pbta';
import type { CharacterData } from '../../../../../../../base/ui/src/types/character';
import { normalizeSceneMode, MODE_LABEL, MODE_BADGE_CLASS } from '../../../shared/sceneModes';
import {
  CONTEXT_GROUP_LABEL,
  CONTEXT_GROUP_ORDER,
  moveContextKey,
  sceneModeLabelFromTags,
  type MoveContextTag,
} from '../../../shared/moveContexts';

export type DeclareStageProps = {
  action: PerformMoveAction;
  value: Record<string, unknown>;
  patch: (next: Record<string, unknown>) => void;
  onPatch?: (next: Record<string, unknown>) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
  readOnly?: boolean;
};

type DwMoveLite = MoveLite & { requires_context?: string[]; casts_spell?: boolean };

type PreparedSpellLite = {
  id: string;
  spell_id?: string;
  title?: string;
  level?: number;
  school?: string;
  description?: string;
  tags?: string[];
  notes?: string;
  is_cantrip?: boolean;
  prepared?: boolean;
};

function parseDwMoves(action: PerformMoveAction): DwMoveLite[] {
  const raw = action?.workflow?.stageData?.moves;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m: any): DwMoveLite | null => {
      if (!m || typeof m !== 'object') return null;
      return {
        id: String(m.id ?? ''),
        title: String(m.title ?? ''),
        kind: m.kind != null ? String(m.kind) : undefined,
        available_stats: Array.isArray(m.available_stats) ? m.available_stats.map(String) : [],
        summary: m.summary != null ? String(m.summary) : undefined,
        trigger: m.trigger != null ? String(m.trigger) : undefined,
        effect: m.effect != null ? String(m.effect) : undefined,
        effect_10_plus: m.effect_10_plus != null ? String(m.effect_10_plus) : undefined,
        effect_7_9: m.effect_7_9 != null ? String(m.effect_7_9) : undefined,
        effect_6_minus: m.effect_6_minus != null ? String(m.effect_6_minus) : undefined,
        casts_spell: Boolean(m.casts_spell),
        requires_context: Array.isArray(m.condition?.requires_context)
          ? m.condition.requires_context.map(String)
          : Array.isArray(m.requires_context)
            ? m.requires_context.map(String)
            : undefined,
      };
    })
    .filter((m): m is DwMoveLite => !!m && !!m.id);
}

function StatChip({ sid, mod, skill }: { sid: string; mod: number; skill: SkillConfig | undefined }) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-xs font-mono"
      style={{
        backgroundColor: skill ? skill.color + '33' : 'rgba(255,255,255,0.1)',
        color: skill?.color ?? 'rgba(255,255,255,0.5)',
      }}
    >
      {skill?.title ?? sid.toUpperCase()} {mod >= 0 ? '+' : ''}{mod}
    </span>
  );
}

function LocalBonusInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(-5, value - 1))} className="rounded border border-white/10 bg-zinc-950/30 p-1 text-white/50 hover:text-white/80">
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        min={-5}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-12 rounded border border-white/10 bg-zinc-950/30 px-1 py-1 text-xs text-center text-white font-mono outline-none"
      />
      <button type="button" onClick={() => onChange(Math.min(5, value + 1))} className="rounded border border-white/10 bg-zinc-950/30 p-1 text-white/50 hover:text-white/80">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function MovePickerPanel({
  allMoves,
  selectedIds,
  skillMap,
  skillsOrder,
  statMods,
  onToggle,
  expanded,
  onExpandedChange,
}: {
  allMoves: DwMoveLite[];
  selectedIds: string[];
  skillMap: Record<string, SkillConfig>;
  skillsOrder: SkillConfig[];
  statMods: Record<string, number>;
  onToggle: (id: string) => void;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [statFilters, setStatFilters] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const statFilterOptions = useMemo(() => {
    const fromMoves = new Set<string>();
    for (const m of allMoves) {
      for (const sid of m.available_stats ?? []) {
        if (sid) fromMoves.add(sid);
      }
    }
    const ordered: string[] = [];
    for (const s of skillsOrder) {
      if (fromMoves.has(s.id)) {
        ordered.push(s.id);
        fromMoves.delete(s.id);
      }
    }
    return [...ordered, ...[...fromMoves].sort()];
  }, [allMoves, skillsOrder]);

  const toggleStatFilter = (sid: string) => {
    setStatFilters((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
    onExpandedChange(true);
  };

  const selectedMoves = selectedIds.map((id) => allMoves.find((m) => m.id === id)).filter(Boolean) as DwMoveLite[];

  const openPicker = () => onExpandedChange(true);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) openPicker();
  };

  const hasTextFilter = query.trim().length > 0;
  const hasStatFilter = statFilters.size > 0;

  const filtered = useMemo(() => {
    let list = allMoves;
    if (hasTextFilter) {
      const q = query.trim().toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q));
    }
    if (hasStatFilter) {
      list = list.filter((m) => (m.available_stats ?? []).some((sid) => statFilters.has(sid)));
    }
    return list;
  }, [allMoves, query, hasTextFilter, hasStatFilter, statFilters]);

  const groups = useMemo(() => {
    if (hasTextFilter || hasStatFilter) return [{ key: 'search' as const, moves: filtered }];
    const byKey = new Map<MoveContextTag | 'class', DwMoveLite[]>();
    for (const m of filtered) {
      const key: MoveContextTag | 'class' =
        m.kind === 'class' || m.kind === 'advanced' ? 'class' : moveContextKey(m.requires_context);
      const list = byKey.get(key) ?? [];
      list.push(m);
      byKey.set(key, list);
    }
    const out: Array<{ key: MoveContextTag | 'class' | 'search'; moves: DwMoveLite[] }> = [];
    for (const key of CONTEXT_GROUP_ORDER) {
      const moves = byKey.get(key);
      if (moves?.length) out.push({ key, moves });
    }
    const classMoves = byKey.get('class');
    if (classMoves?.length) out.push({ key: 'class', moves: classMoves });
    return out;
  }, [filtered, hasTextFilter, hasStatFilter]);

  const statFilterBar =
    statFilterOptions.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-white/30 uppercase tracking-wide shrink-0">Атрибут</span>
        {statFilterOptions.map((sid) => {
          const active = statFilters.has(sid);
          const skill = skillMap[sid];
          const mod = statMods[sid] ?? 0;
          return (
            <button
              key={sid}
              type="button"
              onClick={() => toggleStatFilter(sid)}
              className="rounded border px-2 py-0.5 text-[11px] font-mono transition-colors border-white/10 text-white/50 hover:border-white/25"
              style={
                active && skill
                  ? { borderColor: skill.color, backgroundColor: `${skill.color}33`, color: skill.color }
                  : active
                    ? { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }
                    : undefined
              }
            >
              {skill?.title ?? sid.toUpperCase()} {mod >= 0 ? '+' : ''}
              {mod}
            </button>
          );
        })}
        {hasStatFilter ? (
          <button
            type="button"
            onClick={() => setStatFilters(new Set())}
            className="text-[10px] text-white/35 hover:text-white/70 px-1"
          >
            Сброс
          </button>
        ) : null}
      </div>
    ) : null;

  if (!expanded) {
    return (
      <div className="flex flex-col gap-2 min-h-0">
        {selectedMoves.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded border border-white/10 bg-zinc-950/30 px-2 py-1.5">
            {selectedMoves.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs text-white">
                <span>{m.title}</span>
                <button type="button" onClick={() => onToggle(m.id)} className="text-white/30 hover:text-white/80">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={openPicker}
          placeholder="Поиск хода..."
          className="w-full rounded border border-white/10 bg-zinc-950/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
        />
        {statFilterBar}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="min-h-[38px] w-full flex flex-wrap items-center gap-1.5 rounded border border-white/10 bg-zinc-950/30 px-2 py-1.5">
        {selectedMoves.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs text-white">
            <span>{m.title}</span>
            <button type="button" onClick={() => onToggle(m.id)} className="text-white/30 hover:text-white/80">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !query && selectedIds.length > 0) {
              onToggle(selectedIds[selectedIds.length - 1]);
            }
          }}
          placeholder={selectedMoves.length === 0 ? 'Поиск хода...' : 'Фильтр...'}
          className="flex-1 min-w-[100px] bg-transparent text-sm text-white outline-none placeholder:text-white/30"
        />
      </div>

      {statFilterBar}

      <div className="rounded border border-white/10 bg-zinc-900/80 shadow-inner max-h-[min(52vh,28rem)] min-h-[14rem] overflow-y-auto">
        {groups.map(({ key, moves }) => (
          <div key={String(key)}>
            {key !== 'search' && (
              <div className="px-3 py-1 text-[10px] text-white/25 uppercase tracking-wider border-b border-white/5 sticky top-0 bg-zinc-900 z-10">
                {key === 'class' ? 'Ходы класса' : CONTEXT_GROUP_LABEL[key as MoveContextTag]}
              </div>
            )}
            {moves.map((m) => {
              const isSel = selectedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onToggle(m.id); setQuery(''); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                  style={isSel ? { backgroundColor: 'rgba(255,255,255,0.05)' } : {}}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
                        style={isSel
                          ? { borderColor: 'rgb(34 211 238)', backgroundColor: 'rgb(34 211 238 / 0.2)' }
                          : { borderColor: 'rgba(255,255,255,0.2)' }}
                      >
                        {isSel && <span className="text-cyan-400 text-[9px] leading-none">✓</span>}
                      </span>
                      <span className={`truncate ${isSel ? 'text-white' : 'text-white/70'}`}>{m.title}</span>
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {(m.available_stats ?? []).map((sid) => (
                        <StatChip key={sid} sid={sid} mod={statMods[sid] ?? 0} skill={skillMap[sid]} />
                      ))}
                    </div>
                  </div>
                  {m.summary && <div className="text-[11px] text-white/25 pl-5 line-clamp-2 mt-0.5">{m.summary}</div>}
                </button>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-xs text-white/30 text-center">
            {hasTextFilter || hasStatFilter ? 'Нет ходов по фильтрам' : 'Ничего не найдено'}
          </div>
        )}
      </div>
    </div>
  );
}

export function PerformMoveDeclareStage({ action, value, patch, onPatch, onSubmit, setSubmitEnabled, readOnly }: DeclareStageProps) {
  const { scene } = getSceneBundle(action);
  const entry = action.workflow.context.entry as PerformMoveEntry;
  const allMoves = parseDwMoves(action);

  const sceneMode = normalizeSceneMode((scene as any)?.data?.mode);
  const stageTags = (action.workflow.stageData as any)?.sceneContextTags as string[] | undefined;
  const modeLabel = sceneModeLabelFromTags(stageTags) ?? MODE_LABEL[sceneMode];

  const skills: SkillConfig[] = entry.skills ?? [];
  const skillMap = Object.fromEntries(skills.map((s) => [s.id, s]));
  const actor = scene?.characters?.find((ch: any) => String(ch.id) === String(entry.actor_character_id));
  const actorData = (actor?.data ?? {}) as CharacterData;
  const statMods = actorData.stat_modifiers ?? {};
  const rawStats = actorData.stats ?? {};

  const selectedMoveIds: string[] = Array.isArray(value?.move_ids) ? (value.move_ids as string[]) : [];
  const statId: string = (value?.stat_id as string) ?? '';
  const localBonus: number = asNum(value?.local_bonus, 0);
  const consumeBonusIds: string[] = Array.isArray(value?.consume_bonus_ids)
    ? (value.consume_bonus_ids as string[])
    : [];
  const castSpellEntryId: string = String(value?.cast_spell_entry_id ?? '');

  const foOptions = useMemo(() => {
    const state = actorData.state ?? {};
    const out: Array<{ id: string; spec_id: string; amount: number; description: string }> = [];
    for (const bucket of [state.temp_bonuses, state.resources] as const) {
      for (const raw of bucket ?? []) {
        if (!raw || (raw.spec_id !== 'forward' && raw.spec_id !== 'ongoing')) continue;
        const amount = Number(raw.amount || 0);
        if (amount <= 0) continue;
        out.push({
          id: String(raw.id),
          spec_id: String(raw.spec_id),
          amount,
          description: String(raw.description || raw.spec_id),
        });
      }
    }
    return out;
  }, [actorData.state]);

  const foSum = foOptions.reduce((s, o) => s + o.amount, 0);
  const foTooltip = foOptions.map((o) => `${o.spec_id} ×${o.amount} — ${o.description}`).join('\n') || 'Нет';

  const preparedSpells = useMemo((): PreparedSpellLite[] => {
    const fromStage = (action.workflow.stageData as any)?.preparedSpells;
    if (Array.isArray(fromStage) && fromStage.length > 0) {
      return fromStage
        .filter((s: any) => s && s.id)
        .map((s: any) => ({
          id: String(s.id),
          spell_id: s.spell_id != null ? String(s.spell_id) : undefined,
          title: s.title != null ? String(s.title) : undefined,
          level: s.level != null ? Number(s.level) : undefined,
          school: s.school != null ? String(s.school) : undefined,
          description: s.description != null ? String(s.description) : undefined,
          tags: Array.isArray(s.tags) ? s.tags.map(String) : undefined,
          notes: s.notes != null ? String(s.notes) : undefined,
          is_cantrip: Boolean(s.is_cantrip),
          prepared: true,
        }));
    }
    return (actorData.spellcasting?.spells ?? [])
      .filter((s) => s.prepared)
      .map((s) => ({
        id: String(s.id),
        spell_id: s.spell_id,
        title: s.title,
        level: s.level,
        notes: s.notes,
        prepared: true,
      }));
  }, [action.workflow.stageData, actorData.spellcasting?.spells]);

  const selectedSpell = useMemo(
    () => preparedSpells.find((s) => s.id === castSpellEntryId) ?? null,
    [preparedSpells, castSpellEntryId],
  );

  const [spellExpandedId, setSpellExpandedId] = useState<string | null>(null);

  const isCasterMove = useMemo(
    () =>
      selectedMoveIds.some((mid) => {
        const m = allMoves.find((x) => x.id === mid);
        return Boolean(m?.casts_spell);
      }),
    [selectedMoveIds, allMoves],
  );

  const [pickerExpanded, setPickerExpanded] = useState(selectedMoveIds.length === 0);

  useEffect(() => {
    if (selectedMoveIds.length === 0) setPickerExpanded(true);
  }, [selectedMoveIds.length]);

  const availableStats: string[] = (() => {
    if (selectedMoveIds.length === 0) return [];
    const union = new Set<string>();
    selectedMoveIds.forEach((mid) => {
      const m = allMoves.find((x) => x.id === mid);
      (m?.available_stats ?? []).forEach((sid) => union.add(sid));
    });
    return [...union];
  })();

  const needsRoll = availableStats.length > 0;
  const currentStatMod = statId ? (statMods[statId] ?? null) : null;
  const aidBonus = asNum(entry.aid?.bonus_amount, 0);
  const totalPreview = currentStatMod !== null ? currentStatMod + localBonus + aidBonus : null;
  const valid = selectedMoveIds.length > 0 && (!needsRoll || !!statId);

  const syncPatch = (next: Record<string, unknown>) => {
    if (readOnly) return;
    patch(next);
    onPatch?.(next);
  };

  useEffect(() => {
    if (isCasterMove || !castSpellEntryId || readOnly) return;
    syncPatch({
      cast_spell_entry_id: '',
      cast_spell_id: '',
      cast_spell_title: '',
    });
  }, [isCasterMove]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMove = (mid: string) => {
    if (readOnly) return;
    const next = selectedMoveIds.includes(mid)
      ? selectedMoveIds.filter((x) => x !== mid)
      : [...selectedMoveIds, mid];
    syncPatch({ move_ids: next, move_id: next[0] ?? '', stat_id: '' });
  };

  useEffect(() => {
    if (availableStats.length === 1 && statId !== availableStats[0]) {
      syncPatch({ stat_id: availableStats[0] });
    }
    if (statId && availableStats.length > 0 && !availableStats.includes(statId)) {
      syncPatch({ stat_id: '' });
    }
  }, [selectedMoveIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSubmitEnabled(valid); }, [valid]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSkill = statId ? skillMap[statId] : undefined;

  return (
    <div className="rounded border border-white/10 p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2 flex-wrap">
        <Sparkles className="w-4 h-4 text-cyan-300" />
        <span>Выбор хода</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${MODE_BADGE_CLASS[sceneMode]}`}>
          {modeLabel}
        </span>
      </div>

      <p className="text-xs text-white/40 -mt-2">
        Доступны только ходы, подходящие к типу сцены ({modeLabel.toLowerCase()}).
      </p>

      <div className="rounded border border-white/10 bg-zinc-950/20 p-3 text-sm space-y-1">
        <div className="text-white">{getActorName(scene, entry)}</div>
        {entry.target_kind !== 'none' && <div className="text-white/60">{getTargetName(scene, entry)}</div>}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-white/30 uppercase tracking-wide">Ходы</div>
          {selectedMoveIds.length > 0 && pickerExpanded && (
            <button
              type="button"
              onClick={() => setPickerExpanded(false)}
              className="text-xs text-white/45 hover:text-white/80 transition-colors"
            >
              Скрыть
            </button>
          )}
        </div>
        <MovePickerPanel
          allMoves={allMoves}
          selectedIds={selectedMoveIds}
          skillMap={skillMap}
          skillsOrder={skills}
          statMods={statMods}
          onToggle={toggleMove}
          expanded={pickerExpanded}
          onExpandedChange={setPickerExpanded}
        />
        {allMoves.length === 0 && <div className="text-xs text-amber-300/70 mt-1">Нет ходов для этого типа сцены</div>}
      </div>

      {selectedMoveIds.map((mid) => {
        const m = allMoves.find((x) => x.id === mid);
        if (!m) return null;
        const moveForScores = {
          id: m.id,
          title: m.title,
          kind: (m.kind ?? 'basic') as 'basic',
          available_stats: m.available_stats ?? [],
        };
        return (
          <MoveCard
            key={mid}
            move={m}
            statScores={statScoresForMove(moveForScores, rawStats as Record<string, number>)}
            skills={skills}
          />
        );
      })}

      {selectedMoveIds.length > 0 && needsRoll && (
        <div className="space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-wide">Стат броска</div>
          <div className="flex flex-wrap gap-2">
            {availableStats.map((sid) => {
              const mod = statMods[sid] ?? 0;
              const active = statId === sid;
              const skill = skillMap[sid];
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => syncPatch({ stat_id: sid })}
                  className="rounded border px-3 py-2 text-xs font-mono border-white/10 text-white/50"
                  style={active && skill ? { borderColor: skill.color, backgroundColor: skill.color + '22', color: skill.color } : {}}
                >
                  {skill?.title ?? sid.toUpperCase()} {mod >= 0 ? '+' : ''}{mod}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 uppercase tracking-wide shrink-0">Бонус</span>
            <LocalBonusInput value={localBonus} onChange={(v) => syncPatch({ local_bonus: v })} />
          </div>
        </div>
      )}

      {needsRoll && statId && totalPreview !== null && (
        <div className="rounded border px-3 py-2 text-sm font-mono bg-zinc-950/30">
          2d6 {totalPreview >= 0 ? '+' : ''}{totalPreview}
        </div>
      )}

      {selectedMoveIds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wide">
            <span>Forward + Ongoing</span>
            <span className="font-mono text-amber-200/90 normal-case" title={foTooltip}>
              Σ {foSum}
            </span>
          </div>
          {foOptions.length === 0 ? (
            <div className="text-xs text-white/30">Нет доступных бонусов</div>
          ) : (
            <div className="flex flex-col gap-1">
              {foOptions.map((o) => {
                const on = consumeBonusIds.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={readOnly}
                      onChange={() => {
                        const next = on
                          ? consumeBonusIds.filter((x) => x !== o.id)
                          : [...consumeBonusIds, o.id];
                        syncPatch({ consume_bonus_ids: next });
                      }}
                    />
                    <span className="font-mono text-xs text-amber-200/80">{o.spec_id}</span>
                    <span>×{o.amount}</span>
                    <span className="text-white/40 text-xs truncate">{o.description}</span>
                    {o.spec_id === 'forward' && on && (
                      <span className="text-[10px] text-red-300/70">сгорит</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isCasterMove && (
        <div className="space-y-2">
          <div className="text-xs text-white/40 uppercase tracking-wide">Заклинание (каст)</div>
          {preparedSpells.length === 0 ? (
            <div className="rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/80">
              Нет подготовленных заклинаний — сначала подготовьте их.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[min(40vh,22rem)] overflow-y-auto">
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  syncPatch({
                    cast_spell_entry_id: '',
                    cast_spell_id: '',
                    cast_spell_title: '',
                  })
                }
                className={`w-full rounded border px-3 py-2 text-left text-sm transition-colors ${
                  !castSpellEntryId
                    ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-100'
                    : 'border-white/10 bg-zinc-950/30 text-white/50 hover:bg-white/5'
                }`}
              >
                — без привязки —
              </button>
              {preparedSpells.map((s) => {
                const selected = s.id === castSpellEntryId;
                const open = spellExpandedId === s.id;
                const meta = [
                  s.is_cantrip || s.school === 'фокус'
                    ? 'фокус'
                    : `ур.${s.level ?? 0}`,
                  s.school && s.school !== 'фокус' ? s.school : null,
                  ...(s.tags ?? []),
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <div
                    key={s.id}
                    className={`rounded border overflow-hidden ${
                      selected
                        ? 'border-violet-400/50 bg-violet-950/30'
                        : 'border-white/10 bg-zinc-950/30'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={readOnly}
                      className="w-full text-left px-3 py-2.5 disabled:cursor-default"
                      onClick={() => {
                        if (readOnly) return;
                        syncPatch({
                          cast_spell_entry_id: s.id,
                          cast_spell_id: s.spell_id ?? '',
                          cast_spell_title: s.title ?? '',
                        });
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white/90 truncate">
                            {selected ? '✓ ' : ''}
                            {s.title || s.spell_id || s.id}
                          </div>
                          {meta ? (
                            <div className="mt-0.5 text-[10px] text-white/45">{meta}</div>
                          ) : null}
                        </div>
                        {selected ? (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-violet-400/40 text-violet-100">
                            каст
                          </span>
                        ) : null}
                      </div>
                      {s.description ? (
                        <div
                          className={`mt-1.5 text-xs text-white/55 whitespace-pre-line ${
                            open ? '' : 'line-clamp-2'
                          }`}
                        >
                          {s.description}
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[11px] text-white/30 italic">
                          Описание недоступно
                        </div>
                      )}
                      {s.notes && open ? (
                        <div className="mt-1 text-[11px] text-amber-200/70 whitespace-pre-line">
                          Заметки: {s.notes}
                        </div>
                      ) : null}
                    </button>
                    {(s.description || s.notes) && (
                      <div className="px-3 pb-2">
                        <button
                          type="button"
                          className="text-[10px] text-white/40 hover:text-white/70"
                          onClick={() => setSpellExpandedId(open ? null : s.id)}
                        >
                          {open ? 'Свернуть описание' : 'Читать полностью'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!valid}
        onClick={() =>
          onSubmit({
            move_ids: selectedMoveIds,
            stat_id: statId || '',
            local_bonus: localBonus,
            consume_bonus_ids: consumeBonusIds,
            cast_spell_entry_id: isCasterMove ? castSpellEntryId : '',
            cast_spell_id: isCasterMove ? String(selectedSpell?.spell_id ?? value?.cast_spell_id ?? '') : '',
            cast_spell_title: isCasterMove
              ? String(selectedSpell?.title ?? value?.cast_spell_title ?? '')
              : '',
          })
        }
        className={`rounded border px-3 py-2 text-sm font-semibold ${valid ? 'border-cyan-400/70 text-cyan-200' : 'border-white/10 text-white/30 cursor-not-allowed'}`}
      >
        Подтвердить ход
      </button>
    </div>
  );
}
