'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CharacterConfig, PbtaSkill, Move } from '../types';
import type { ValidationIssue } from '../types';
import { MoveExpandable, toMoveDisplayData } from '../shared/moves';
import { ClassMoveOverrideEditor } from '../shared/moves/ClassMoveOverrideEditor';
import { MoveTooltip } from '../shared/MoveCard';
import { CharacterResourcesPanel } from '../shared/CharacterResourcesPanel';
import { CustomMovesEditor } from '../shared/CustomMovesEditor';
import {
  pbtaModifier, modStr, alpha,
  statScoresForMove, movesForStat,
  matchStatArray, computeCharacterStats,
  DEFAULT_STAT_ORDER,
} from '../lib/pbta';
import { getPlaybookId, getStats } from '../types/character';
import type { CharacterData } from '../types/character';
import { getResourceSpecs } from '../types/pbta';
import type { MoveTextOverride } from '../types/pbta';
import { effectiveMove } from '../lib/moves';

const DEFAULT_INITIAL: CharacterData = {
  playbook_id: '',
  moves:      [],
  custom_moves: [],
  stats:      {},
  stat_modifiers: {},
  state:      {},
  move_overrides: {},
};

function startingChoiceIds(pb: { starting_move_choices?: string[][] } | null): string[] {
  return (pb?.starting_move_choices ?? []).flat();
}

function startingChoiceGroup(
  pb: { starting_move_choices?: string[][] } | null,
  moveId: string,
): string[] | null {
  for (const group of pb?.starting_move_choices ?? []) {
    if (group.includes(moveId)) return group;
  }
  return null;
}

function normalizeCharacterData<TData extends CharacterData>(
  data: TData,
  init: CharacterData,
): { next: TData; changed: boolean } {
  const next = structuredClone(data) as TData;
  let changed = false;

  if (!getPlaybookId(next)) {
    (next as CharacterData).playbook_id = init.playbook_id ?? '';
    changed = true;
  }
  if (!Array.isArray(next.moves)) {
    next.moves = structuredClone(init.moves ?? []);
    changed = true;
  }
  if (!Array.isArray(next.custom_moves)) {
    next.custom_moves = structuredClone(init.custom_moves ?? []);
    changed = true;
  }
  if (!next.stats || typeof next.stats !== 'object') {
    next.stats = structuredClone(init.stats ?? {});
    changed = true;
  }
  if (!next.stat_modifiers || typeof next.stat_modifiers !== 'object') {
    next.stat_modifiers = structuredClone(init.stat_modifiers ?? {});
    changed = true;
  }
  if (!next.state || typeof next.state !== 'object') {
    next.state = structuredClone(init.state ?? {});
    changed = true;
  }
  if (!next.move_overrides || typeof next.move_overrides !== 'object') {
    next.move_overrides = structuredClone(init.move_overrides ?? {});
    changed = true;
  }

  return { next, changed };
}

type Props<TData extends CharacterData = CharacterData> = {
  data: TData;
  config: CharacterConfig;
  issues?: ValidationIssue[];
  onChange: (next: TData) => void;
  /** Hide playbook + stats (+ resources unless shown elsewhere). */
  hideSheet?: boolean;
  /** Hide class/basic/custom moves. */
  hideMoves?: boolean;
  /** Hide CharacterResourcesPanel. */
  hideResources?: boolean;
};



export default function CharacterDataEditor<TData extends CharacterData = CharacterData>({
  data,
  config,
  issues,
  onChange,
  hideSheet = false,
  hideMoves = false,
  hideResources = false,
}: Props<TData>) {
  useEffect(() => {
    const init = (config?.initialData ?? DEFAULT_INITIAL) as CharacterData;

    if (!data || typeof data !== 'object') {
      onChange(structuredClone(init) as TData);
      return;
    }

    const { next, changed } = normalizeCharacterData(data as TData, init);
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const dataRef = useRef(data);
  dataRef.current = data;

  const pbtaSkills: PbtaSkill[] = config?.pbta?.skills ?? [];
  const playbooks = config?.pbta?.playbooks ?? [];
  const moves: Move[] = config?.pbta?.moves ?? [];
  const resourceSpecs = getResourceSpecs(config?.pbta);
  const statArrays = config?.constraints?.stat_arrays ?? [];
  const statMin = config?.constraints?.stat_min ?? 3;
  const statMax = config?.constraints?.stat_max ?? 18;

  const currentStats = getStats(data);
  const currentPlaybookId = getPlaybookId(data);
  const currentMoves = data?.moves ?? [];
  const moveOverridesRoot = data.move_overrides ?? {};

  const movesMap = useMemo(() => new Map(moves.map((m) => [m.id, m])), [moves]);
  const basicMoves = useMemo(() => moves.filter((m) => m.kind === 'basic'), [moves]);
  const basicMoveIds = useMemo(() => new Set(basicMoves.map((m) => m.id)), [basicMoves]);

  const issueMap = useMemo(() => {
    const map = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) {
      const path = i.path.startsWith('data.') ? i.path.slice(5) : i.path;
      map.set(path, i);
    }
    return map;
  }, [issues]);

  const [showBasicMoves, setShowBasicMoves] = useState(false);
  const [classMoveFilter, setClassMoveFilter] = useState<'all' | 'starting' | 'advanced' | 'master'>('all');
  const [openClassMoveIds, setOpenClassMoveIds] = useState<Set<string>>(() => new Set());
  const [textEditMoveId, setTextEditMoveId] = useState<string | null>(null);
  const playbookObj = playbooks.find((p) => p.id === currentPlaybookId) ?? null;
  const characterLevel = Number((data as CharacterData & { level?: number }).level ?? 1);

  const setClassMoveOpen = (mid: string, open: boolean) => {
    setOpenClassMoveIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(mid);
      else {
        next.delete(mid);
        if (textEditMoveId === mid) setTextEditMoveId(null);
      }
      return next;
    });
  };

  const toggleClassMoveTextEdit = (mid: string) => {
    if (textEditMoveId === mid) {
      setTextEditMoveId(null);
      return;
    }
    setTextEditMoveId(mid);
    setOpenClassMoveIds((prev) => new Set(prev).add(mid));
  };

  const { maxHp, maxLoad, damageDie, conMod, conScore, strMod } =
    computeCharacterStats(playbookObj, currentStats);

  const currentStatSet = useMemo(() => {
    const vals = pbtaSkills.map((s) => Number(currentStats[s.id] ?? 0));
    return vals.sort((a, b) => b - a);
  }, [pbtaSkills, currentStats]);

  const matchedArrayIdx = useMemo(
    () => statArrays.findIndex((arr) => matchStatArray(arr, currentStatSet)),
    [statArrays, currentStatSet],
  );

  const setStat = (sid: string, value: number) => {
    onChange({
      ...structuredClone(data),
      stats: { ...(data.stats ?? {}), [sid]: value },
    } as TData);
  };

  const setPlaybook = (playbookId: string) => {
    const next = structuredClone(data) as TData;
    const newPb = playbooks.find((p) => p.id === playbookId);
    const customIds = new Set((next.custom_moves ?? []).map((m) => m.id));

    (next as any).playbook_id = playbookId;

    // Drop all previous class/race/advanced moves; keep basic + custom only.
    const kept = (next.moves ?? []).filter(
      (mid) => basicMoveIds.has(mid) || customIds.has(mid),
    );
    next.moves = Array.from(new Set([...kept, ...(newPb?.starting_moves ?? [])]));

    if (next.move_overrides) {
      const keepMoves = new Set(next.moves);
      next.move_overrides = Object.fromEntries(
        Object.entries(next.move_overrides).filter(([mid]) => keepMoves.has(mid)),
      );
    }

    (next as CharacterData).race_id = '';
    (next as CharacterData).alignment_id = '';
    (next as CharacterData).alignment_notes = '';
    onChange(next);
  };

  const toggleMove = (moveId: string, checked: boolean) => {
    const next = structuredClone(data) as TData;
    const arr = Array.isArray(next.moves) ? [...next.moves] : [];
    if (checked) {
      const group = startingChoiceGroup(playbookObj, moveId);
      if (group) {
        for (const sibling of group) {
          const idx = arr.indexOf(sibling);
          if (idx >= 0) arr.splice(idx, 1);
        }
      }
      if (!arr.includes(moveId)) arr.push(moveId);
    } else {
      const idx = arr.indexOf(moveId);
      if (idx >= 0) arr.splice(idx, 1);
      if (next.move_overrides?.[moveId]) {
        const mo = { ...next.move_overrides };
        delete mo[moveId];
        next.move_overrides = mo;
      }
    }
    next.moves = arr;
    onChange(next);
  };

  const applyStatArray = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => b - a);
    const targetIds = DEFAULT_STAT_ORDER.filter((sid) => pbtaSkills.some((s) => s.id === sid));
    const next = structuredClone(data) as TData;
    next.stats = { ...(next.stats ?? {}) };
    targetIds.forEach((sid, i) => {
      if (i < sorted.length) next.stats[sid] = sorted[i];
    });
    onChange(next);
  };

  const setMoveOverrides = (nextOverrides: Record<string, MoveTextOverride>) => {
    const base = dataRef.current as TData;
    onChange({ ...structuredClone(base), move_overrides: nextOverrides } as TData);
  };

  const renderClassMoveEditor = (codex: Move, mid: string, active: boolean) => {
    if (!active) return null;
    return (
      <ClassMoveOverrideEditor
        moveId={mid}
        codexMove={codex}
        override={moveOverridesRoot[mid]}
        overridesRoot={moveOverridesRoot}
        onChange={setMoveOverrides}
        onDone={() => setTextEditMoveId(null)}
      />
    );
  };

  return (
    <div className="space-y-6">

      {!hideSheet && (
        <>
      {/* ── Класс ──────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="text-sm text-gray-300">Класс</div>
        <select
          className="w-full md:w-1/2 rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1"
          value={currentPlaybookId}
          onChange={(e) => setPlaybook(e.target.value)}
        >
          <option value="">— без класса —</option>
          {playbooks.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {playbookObj?.summary && (
          <div className="text-xs text-gray-400">{playbookObj.summary}</div>
        )}

        {playbookObj && (
          <div className="flex flex-wrap gap-2">
            <StatChip label="Макс. ОЗ" value={maxHp}     hint={`${playbookObj.base_hp} + CON ${conScore}`} />
            <StatChip label="Урон"      value={damageDie} />
            <StatChip label="Нагрузка"  value={maxLoad}   hint={`${playbookObj.base_load} + STR ${modStr(strMod)}`} />
          </div>
        )}

        {playbookObj && (playbookObj.races?.length || playbookObj.alignments?.length) ? (
          <section className="space-y-3 pt-2 border-t border-gray-800">
            <div className="text-sm text-gray-300">Раса и мировоззрение</div>
            {playbookObj.races?.length ? (
              <label className="flex flex-col gap-1 text-xs text-gray-400 max-w-md">
                <span>Раса</span>
                <select
                  className="rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1"
                  value={(data as CharacterData).race_id ?? ''}
                  onChange={(e) => {
                    const next = structuredClone(data) as TData;
                    (next as CharacterData).race_id = e.target.value;
                    const race = playbookObj.races?.find((r) => r.id === e.target.value);
                    if (race) {
                      const moves = [...(next.moves ?? [])];
                      const oldRaceMoveIds = new Set(
                        (playbookObj.races ?? []).map((r) => r.move_id),
                      );
                      next.moves = moves.filter((mid) => !oldRaceMoveIds.has(mid));
                      if (!next.moves.includes(race.move_id)) {
                        next.moves.push(race.move_id);
                      }
                    }
                    onChange(next);
                  }}
                >
                  <option value="">— выберите расу —</option>
                  {playbookObj.races.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {playbookObj.alignments?.length ? (
              <>
                <label className="flex flex-col gap-1 text-xs text-gray-400 max-w-md">
                  <span>Мировоззрение</span>
                  <select
                    className="rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1"
                    value={(data as CharacterData).alignment_id ?? ''}
                    onChange={(e) => {
                      const next = structuredClone(data) as TData;
                      const aid = e.target.value;
                      (next as CharacterData).alignment_id = aid;
                      const align = playbookObj.alignments?.find((a) => a.id === aid);
                      const notes = (next as CharacterData).alignment_notes?.trim();
                      if (align && !notes) {
                        (next as CharacterData).alignment_notes = align.summary;
                      }
                      onChange(next);
                    }}
                  >
                    <option value="">— выберите —</option>
                    {playbookObj.alignments.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-gray-400">
                  <span>Смысл мировоззрения (можно менять в игре)</span>
                  <Textarea
                    className="min-h-[72px] bg-zinc-950/40 text-sm"
                    value={(data as CharacterData).alignment_notes ?? ''}
                    onChange={(e) => {
                      const next = structuredClone(data) as TData;
                      (next as CharacterData).alignment_notes = e.target.value;
                      onChange(next);
                    }}
                    placeholder={
                      playbookObj.alignments?.find(
                        (a) => a.id === (data as CharacterData).alignment_id,
                      )?.summary ?? 'Как это проявляется у вашего героя…'
                    }
                  />
                </label>
              </>
            ) : null}
          </section>
        ) : null}
      </section>

      {!hideResources && (
        <CharacterResourcesPanel
          data={data}
          resourceSpecs={resourceSpecs}
          editable
          onChange={(next) => onChange(next as TData)}
        />
      )}

      {/* ── Наборы статов ──────────────────────────────────────────────────── */}
      {statArrays.length > 0 && (
        <section className="space-y-2">
          <div className="text-sm text-gray-300">
            Наборы характеристик
            <span className="ml-2 text-xs text-gray-500">
              (значения распределятся по STR→DEX→CON→INT→WIS→CHA)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statArrays.map((arr, idx) => {
              const sorted   = [...arr].sort((a, b) => b - a);
              const isActive = matchedArrayIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyStatArray(arr)}
                  className={`
                    rounded border px-3 py-1.5 text-xs font-mono transition-colors
                    ${isActive
                      ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                      : 'border-gray-700 bg-black/30 text-gray-300 hover:border-gray-500'}
                  `}
                >
                  {isActive && <span className="mr-1.5 text-emerald-400">✓</span>}
                  {sorted.join(' / ')}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Характеристики ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="text-sm text-gray-300">Характеристики</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {pbtaSkills.map((s) => {
            const score      = Number(currentStats[s.id] ?? 10);
            const mod        = pbtaModifier(score);
            const issue      = issueMap.get(`stats.${s.id}`);
            const isErr      = !!issue && issue.icon === 'error';
            const statBg     = alpha(s.color, 0.12);
            const statBorder = alpha(s.color, isErr ? 0 : 0.55);
            const related    = movesForStat(s.id, playbookObj, movesMap, basicMoveIds);

            return (
              <div
                key={s.id}
                className="rounded border p-3 bg-black/20 space-y-2"
                style={{ borderColor: isErr ? undefined : (statBorder ?? '#374151') }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span
                      className="rounded border px-1.5 py-0.5 text-sm font-semibold text-gray-100"
                      style={{ borderColor: statBorder ?? '#374151', backgroundColor: statBg ?? 'rgba(0,0,0,0.2)' }}
                    >
                      {s.title ?? s.id.toUpperCase()}
                    </span>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: s.color ?? '#9ca3af' }}>
                      {s.id.toUpperCase()}
                    </div>
                  </div>
                  <div className={`text-xl font-bold font-mono w-10 text-center select-none ${mod > 0 ? 'text-emerald-400' : mod < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {modStr(mod)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={score}
                    min={statMin}
                    max={statMax}
                    onChange={(e) => {
                      const v = Number(e.target.value || statMin);
                      setStat(s.id, Math.max(statMin, Math.min(statMax, v)));
                    }}
                    className={['w-20 text-center', isErr ? 'border-red-500 focus-visible:ring-red-500/30' : ''].join(' ')}
                    style={!isErr ? { borderColor: statBorder ?? undefined } : undefined}
                  />
                  <span className="text-[10px] text-gray-600">{statMin}–{statMax}</span>
                </div>

                {issue && <IssueBar issue={issue} />}

                {related.length > 0 && (
                  <div className="space-y-0.5 border-t pt-1.5" style={{ borderColor: statBorder ?? '#374151' }}>
                    {related.map((m) => {
                      const active      = currentMoves.includes(m.id);
                      const isBasic     = basicMoveIds.has(m.id);
                      const isMultiStat = (m.available_stats ?? []).length > 1;
                      return (
                        <div key={m.id} className="relative group">
                          <div className={`text-[11px] rounded px-1.5 py-0.5 cursor-default truncate ${isBasic ? (active ? 'text-emerald-300 bg-emerald-950/40' : 'text-emerald-600') : (active ? 'text-indigo-300 bg-indigo-950/50' : 'text-gray-500')}`}>
                            {m.title}
                            {isMultiStat && <span className="ml-1 text-[9px] text-gray-600" title="Выбор стата">⤷</span>}
                          </div>
                          <div className="pointer-events-none absolute z-40 left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block">
                            <MoveTooltip move={m} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {issueMap.get('stats') && <IssueBar issue={issueMap.get('stats')!} />}
      </section>
        </>
      )}

      {!hideMoves && (
        <>
      {/* ── Ходы класса ────────────────────────────────────────────────────── */}
      {playbookObj && (() => {
        const startingIds = playbookObj.starting_moves ?? [];
        const choiceIds   = startingChoiceIds(playbookObj);
        const advancedIds = playbookObj.advanced_moves ?? [];
        const masterIds   = playbookObj.advanced_moves_6_10 ?? [];
        const startingSet = new Set(startingIds);
        const choiceSet   = new Set(choiceIds);
        const masterSet   = new Set(masterIds);
        const raceMoveIds = (playbookObj.races ?? []).map((r) => r.move_id);

        let visibleIds: string[] = [];
        switch (classMoveFilter) {
          case 'starting':
            visibleIds = [...startingIds, ...choiceIds];
            break;
          case 'advanced':
            visibleIds = [...advancedIds];
            break;
          case 'master':
            visibleIds = [...masterIds];
            break;
          default:
            visibleIds = [...startingIds, ...choiceIds, ...advancedIds, ...masterIds];
            for (const rid of raceMoveIds) {
              if (currentMoves.includes(rid) && !visibleIds.includes(rid)) {
                visibleIds.push(rid);
              }
            }
        }

        if (!visibleIds.length && classMoveFilter === 'master' && !masterIds.length) {
          return (
            <section className="space-y-2">
              <div className="text-sm text-gray-300">Ходы класса</div>
              <ClassMoveFilterBar filter={classMoveFilter} onFilter={setClassMoveFilter} masterCount={0} />
              <div className="text-xs text-gray-500">Для этого класса нет отдельных ходов уровней 6–10 в кодексе.</div>
            </section>
          );
        }
        if (!startingIds.length && !choiceIds.length && !advancedIds.length && !masterIds.length) {
          return <div className="text-xs text-gray-500">Ходы не заданы.</div>;
        }

        const movesIssue = issueMap.get('moves');
        const choiceGroups = playbookObj.starting_move_choices ?? [];
        const missingChoice =
          choiceGroups.length > 0 &&
          choiceGroups.some(
            (group) => !group.some((mid) => currentMoves.includes(mid)),
          );

        return (
          <section className="space-y-2">
            <ClassMoveFilterBar
              filter={classMoveFilter}
              onFilter={setClassMoveFilter}
              masterCount={masterIds.length}
            />
            {missingChoice && (
              <div className="text-xs text-amber-500/90">
                Выберите один стартовый ход из каждой группы вариантов (отмечено ниже).
              </div>
            )}
            {characterLevel < 2 && classMoveFilter === 'advanced' && (
              <div className="text-xs text-amber-500/90">Продвинутые ходы доступны с 2 уровня (сейчас {characterLevel}).</div>
            )}
            {characterLevel < 6 && classMoveFilter === 'master' && masterIds.length > 0 && (
              <div className="text-xs text-amber-500/90">Ходы 6–10 доступны с 6 уровня (сейчас {characterLevel}).</div>
            )}
            {movesIssue && <IssueBar issue={movesIssue} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleIds.map((mid) => {
                const codex = movesMap.get(mid);
                if (!codex) return null;
                const isStarting = startingSet.has(mid);
                const isChoice   = choiceSet.has(mid);
                const isMaster   = masterSet.has(mid);
                const isRace     = codex.kind === 'race';
                const active = isStarting || currentMoves.includes(mid);
                const needsLevel2 =
                  !isStarting && !isChoice && !isRace && !isMaster && characterLevel < 2;
                const needsLevel6 = isMaster && characterLevel < 6;
                const displayMove = effectiveMove(codex, moveOverridesRoot, mid) ?? codex;
                const tierBadge = isRace
                  ? 'раса'
                  : isStarting
                    ? 'старт'
                    : isChoice
                      ? 'старт: выбор'
                      : isMaster
                        ? 'ур. 6+'
                        : 'ур. 2+';
                return (
                  <MoveExpandable
                    key={mid}
                    move={toMoveDisplayData(displayMove)}
                    checked={currentMoves.includes(mid)}
                    isStarting={isStarting}
                    disabled={needsLevel2 || needsLevel6}
                    disabledHint={
                      needsLevel6
                        ? 'С 6 уровня'
                        : needsLevel2
                          ? 'С 2 уровня'
                          : undefined
                    }
                    statScores={statScoresForMove(codex, currentStats)}
                    skills={pbtaSkills}
                    onToggle={
                      isStarting
                        ? undefined
                        : (c) => {
                            if (needsLevel2 || needsLevel6) return;
                            toggleMove(mid, c);
                          }
                    }
                    displayMode="edit"
                    expanded={openClassMoveIds.has(mid)}
                    onExpandedChange={(o) => setClassMoveOpen(mid, o)}
                    textSheetEditing={textEditMoveId === mid}
                    onTextSheetEdit={active ? () => toggleClassMoveTextEdit(mid) : undefined}
                    placeholderEditor={renderClassMoveEditor(codex, mid, active)}
                    tierBadge={isStarting ? undefined : tierBadge}
                  />
                );
              })}
            </div>
          </section>
        );
      })()}

      <CustomMovesEditor
        data={data}
        skills={pbtaSkills}
        currentStats={currentStats}
        resourceSpecs={resourceSpecs}
        onChange={(next) => onChange(next as TData)}
      />

      {/* ── Базовые ходы ───────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-gray-700 bg-black/40 text-gray-200 hover:border-gray-500"
          onClick={() => setShowBasicMoves((v) => !v)}
        >
          {showBasicMoves ? 'Скрыть базовые ходы' : 'Показать базовые ходы'}
        </button>
        {showBasicMoves && (
          <div className="space-y-2 mt-2">
            <div className="text-sm text-gray-300">Базовые ходы</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {basicMoves.map((m) => (
                <MoveExpandable
                  key={m.id}
                  move={toMoveDisplayData(m)}
                  checked
                  isStarting={false}
                  statScores={statScoresForMove(m, currentStats)}
                  skills={pbtaSkills}
                />
              ))}
            </div>
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}

// ── Вспомогательные компоненты ─────────────────────────────────────────────

function ClassMoveFilterBar({
  filter,
  onFilter,
  masterCount,
}: {
  filter: 'all' | 'starting' | 'advanced' | 'master';
  onFilter: (f: 'all' | 'starting' | 'advanced' | 'master') => void;
  masterCount: number;
}) {
  const chips: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'starting', label: 'Стартовые' },
    { id: 'advanced', label: 'Продвинутые (2+)' },
    { id: 'master', label: 'Уровни 6–10' },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="text-sm text-gray-300">Ходы класса</div>
      {chips.map(({ id, label }) => {
        if (id === 'master' && masterCount === 0) return null;
        const active = filter === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onFilter(id)}
            className={`
              text-[10px] rounded border px-2 py-0.5 transition-colors
              ${active
                ? 'border-indigo-600 bg-indigo-950/50 text-indigo-200'
                : 'border-gray-700 bg-black/30 text-gray-400 hover:border-gray-500'}
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StatChip({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded border border-gray-700 bg-black/30 px-3 py-1.5 flex items-center gap-2">
      <span className="text-[10px] uppercase text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-100">{value}</span>
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </div>
  );
}

function LabeledNumberInput({
  label, value, min, max, onChange,
}: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          let v = Number(e.target.value ?? min ?? 0);
          if (min != null) v = Math.max(min, v);
          if (max != null) v = Math.min(max, v);
          onChange(v);
        }}
        className="w-20 text-center text-sm"
      />
    </div>
  );
}

function IssueBar({ issue }: { issue: ValidationIssue }) {
  return (
    <div className={`text-xs px-2 py-1.5 rounded border ${issue.icon === 'error' ? 'text-red-400 border-red-800 bg-red-950/20' : 'text-yellow-300 border-yellow-800 bg-yellow-950/20'}`}>
      {issue.message}
    </div>
  );
}