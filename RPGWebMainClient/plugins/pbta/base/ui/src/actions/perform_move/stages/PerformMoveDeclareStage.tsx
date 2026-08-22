"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ChevronDown, X, Plus, Minus } from "lucide-react";
import { getSceneBundle } from "plugins/common/types/actionSelectors";
import {
  parseMovesFromStageData,
  getActorName,
  getTargetName,
  asNum,
  type MoveLite,
  type SkillConfig,
  type PerformMoveAction,
  type PerformMoveEntry,
} from "../types";
import { MoveCard } from "../components/MoveCard";
import type { CharacterData } from "../../../types/character";

// ── Типы ──────────────────────────────────────────────────────────────────────

export type DeclareStageProps = {
  action:           PerformMoveAction;
  value:            Record<string, unknown>;
  patch:            (next: Record<string, unknown>) => void;
  onSubmit:         (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

// ── StatChip ──────────────────────────────────────────────────────────────────

function StatChip({ sid, mod, skill }: {
  sid:   string;
  mod:   number;
  skill: SkillConfig | undefined;
}) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-xs font-mono"
      style={{
        backgroundColor: skill ? skill.color + "33" : "rgba(255,255,255,0.1)",
        color:           skill?.color ?? "rgba(255,255,255,0.5)",
      }}
    >
      {skill?.title ?? sid.toUpperCase()} {mod >= 0 ? "+" : ""}{mod}
    </span>
  );
}

// ── LocalBonusInput ───────────────────────────────────────────────────────────

function LocalBonusInput({ value, onChange }: {
  value:    number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(-5, value - 1))}
        className="rounded border border-white/10 bg-zinc-950/30 p-1 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        min={-5}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-12 rounded border border-white/10 bg-zinc-950/30 px-1 py-1 text-xs text-center text-white font-mono outline-none focus:border-white/30"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(5, value + 1))}
        className="rounded border border-white/10 bg-zinc-950/30 p-1 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
      {value !== 0 && (
        <span className={`text-xs font-mono ml-1 ${value > 0 ? "text-emerald-300" : "text-red-300"}`}>
          {value > 0 ? `+${value}` : value}
        </span>
      )}
    </div>
  );
}

// ── MoveCombobox ──────────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  basic:    "Базовые ходы",
  class:    "Ходы класса",
  advanced: "Продвинутые ходы",
};

function MoveCombobox({ allMoves, selectedIds, skillMap, skillsOrder, statMods, onToggle }: {
  allMoves:    MoveLite[];
  selectedIds: string[];
  skillMap:    Record<string, SkillConfig>;
  skillsOrder: SkillConfig[];
  statMods:    Record<string, number>;
  onToggle:    (id: string) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [statFilters, setStatFilters] = useState<Set<string>>(() => new Set());
  const ref               = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

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
    setOpen(true);
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

  const order = ["basic", "class", "advanced"];
  const groups = hasTextFilter || hasStatFilter
    ? [{ kind: "search", moves: filtered }]
    : [
        ...order
          .map((kind) => ({ kind, moves: filtered.filter((m) => m.kind === kind) }))
          .filter((g) => g.moves.length > 0),
        ...(filtered.filter((m) => !order.includes(m.kind ?? "")).length > 0
          ? [{ kind: "other", moves: filtered.filter((m) => !order.includes(m.kind ?? "")) }]
          : []),
      ];

  const selectedMoves = selectedIds
    .map((id) => allMoves.find((m) => m.id === id))
    .filter(Boolean) as MoveLite[];

  const statFilterBar =
    statFilterOptions.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <span className="text-[10px] text-white/30 uppercase tracking-wide shrink-0">Атрибут</span>
        {statFilterOptions.map((sid) => {
          const active = statFilters.has(sid);
          const skill = skillMap[sid];
          const mod = statMods[sid] ?? 0;
          return (
            <button
              key={sid}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleStatFilter(sid);
              }}
              className="rounded border px-2 py-0.5 text-[11px] font-mono transition-colors border-white/10 text-white/50 hover:border-white/25"
              style={
                active && skill
                  ? { borderColor: skill.color, backgroundColor: `${skill.color}33`, color: skill.color }
                  : active
                    ? { borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.9)" }
                    : undefined
              }
            >
              {skill?.title ?? sid.toUpperCase()} {mod >= 0 ? "+" : ""}
              {mod}
            </button>
          );
        })}
        {hasStatFilter ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStatFilters(new Set());
            }}
            className="text-[10px] text-white/35 hover:text-white/70 px-1"
          >
            Сброс
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={ref} className="relative">
      {/* Поле */}
      <div
        className="min-h-[38px] w-full flex flex-wrap items-center gap-1.5 rounded border border-white/10 bg-zinc-950/30 px-2 py-1.5 cursor-text transition-colors hover:border-white/20"
        onClick={() => setOpen(true)}
      >
        {selectedMoves.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs text-white"
          >
            <span>{m.title}</span>
            {(m.available_stats ?? []).map((sid) => (
              <StatChip key={sid} sid={sid} mod={statMods[sid] ?? 0} skill={skillMap[sid]} />
            ))}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(m.id); }}
              className="ml-0.5 text-white/30 hover:text-white/80 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // Backspace на пустом поле удаляет последний тег
            if (e.key === "Backspace" && !query && selectedIds.length > 0) {
              onToggle(selectedIds[selectedIds.length - 1]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={selectedMoves.length === 0 ? "Выбери ход..." : ""}
          className="flex-1 min-w-[100px] bg-transparent text-sm text-white outline-none placeholder:text-white/30"
        />

        <ChevronDown
          className="w-4 h-4 text-white/30 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </div>

      {statFilterBar}

      {/* Дропдаун */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded border border-white/10 bg-zinc-900 shadow-xl max-h-72 overflow-y-auto">
          {groups.map(({ kind, moves }) => (
            <div key={kind}>
              {kind !== "search" && (
                <div className="px-3 py-1 text-[10px] text-white/25 uppercase tracking-wider border-b border-white/5 sticky top-0 bg-zinc-900">
                  {KIND_LABELS[kind] ?? kind}
                </div>
              )}
              {moves.map((m) => {
                const isSel = selectedIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onToggle(m.id); setQuery(""); }}
                    className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5 flex flex-col gap-0.5"
                    style={isSel ? { backgroundColor: "rgba(255,255,255,0.05)" } : {}}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        {/* Чекбокс */}
                        <span
                          className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors"
                          style={isSel
                            ? { borderColor: "rgb(34 211 238)", backgroundColor: "rgb(34 211 238 / 0.2)" }
                            : { borderColor: "rgba(255,255,255,0.2)" }
                          }
                        >
                          {isSel && <span className="text-cyan-400 text-[9px] leading-none">✓</span>}
                        </span>
                        <span className={isSel ? "text-white" : "text-white/70"}>{m.title}</span>
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {(m.available_stats ?? []).map((sid) => (
                          <StatChip key={sid} sid={sid} mod={statMods[sid] ?? 0} skill={skillMap[sid]} />
                        ))}
                      </div>
                    </div>
                    {m.trigger && (
                      <div className="text-[11px] text-white/25 pl-5 line-clamp-1">{m.trigger}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-xs text-white/30 text-center">
              {hasTextFilter || hasStatFilter ? "Нет ходов по фильтрам" : "Ничего не найдено"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export function PerformMoveDeclareStage({
  action, value, patch, onSubmit, setSubmitEnabled,
}: DeclareStageProps) {
  const { scene } = getSceneBundle(action);
  const entry     = action.workflow.context.entry as PerformMoveEntry;
  const allMoves  = parseMovesFromStageData(action);

  const skills: SkillConfig[] = entry.skills ?? [];
  const skillMap = Object.fromEntries(skills.map((s) => [s.id, s]));

  const actor    = scene?.characters?.find(
    (ch: any) => String(ch.id) === String(entry.actor_character_id)
  );
  const actorData = (actor?.data ?? {}) as CharacterData;
  const rawStats  = actorData.stats           ?? {};
  const statMods  = actorData.stat_modifiers  ?? {};

  // ── Форма ─────────────────────────────────────────────────────────────────

  const selectedMoveIds: string[] = Array.isArray(value?.move_ids)
    ? (value.move_ids as string[])
    : [];
  const statId:     string = (value?.stat_id as string) ?? "";
  const localBonus: number = asNum(value?.local_bonus, 0);

  // Объединение (union) доступных статов по всем выбранным ходам
  const availableStats: string[] = (() => {
    if (selectedMoveIds.length === 0) return [];
    const union = new Set<string>();
    selectedMoveIds.forEach((mid) => {
      const m = allMoves.find((x) => x.id === mid);
      (m?.available_stats ?? []).forEach((sid) => union.add(sid));
    });
    return [...union];
  })();

  const needsRoll      = availableStats.length > 0;
  const currentStatMod = statId ? (statMods[statId] ?? null) : null;
  const aidBonus       = asNum(entry.aid?.bonus_amount, 0);
  const totalPreview   = currentStatMod !== null
    ? currentStatMod + localBonus + aidBonus
    : null;

  const valid = selectedMoveIds.length > 0 && (!needsRoll || !!statId);

  const toggleMove = (mid: string) => {
    const next = selectedMoveIds.includes(mid)
      ? selectedMoveIds.filter((x) => x !== mid)
      : [...selectedMoveIds, mid];
    patch({ move_ids: next, move_id: next[0] ?? "", stat_id: "" });
  };

  // Автовыбор / сброс стата
  useEffect(() => {
    if (availableStats.length === 1 && statId !== availableStats[0]) {
      patch({ stat_id: availableStats[0] });
    }
    if (statId && availableStats.length > 0 && !availableStats.includes(statId)) {
      patch({ stat_id: "" });
    }
  }, [selectedMoveIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSubmitEnabled(valid); }, [valid]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSkill = statId ? skillMap[statId] : undefined;

  return (
    <div className="rounded border border-white/10 p-3 flex flex-col gap-4">

      {/* Заголовок */}
      <div className="font-medium flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-cyan-300" />
        Выбор хода
      </div>

      {/* Актор / цель */}
      <div className="rounded border border-white/10 bg-zinc-950/20 p-3 text-sm space-y-1">
        <div className="text-white">{getActorName(scene, entry)}</div>
        {entry.target_kind !== "none" && (
          <div className="text-white/60">{getTargetName(scene, entry)}</div>
        )}
        {entry.aid?.accepted && (
          <div className="text-emerald-300/80 text-xs">+1 от помощника</div>
        )}
      </div>

      {/* Комбобокс */}
      <div className="space-y-1">
        <div className="text-xs text-white/30 uppercase tracking-wide">Ходы</div>
        <MoveCombobox
          allMoves={allMoves}
          selectedIds={selectedMoveIds}
          skillMap={skillMap}
          skillsOrder={skills}
          statMods={statMods}
          onToggle={toggleMove}
        />
        {allMoves.length === 0 && (
          <div className="text-xs text-amber-300/70 mt-1">Ходы не загружены</div>
        )}
      </div>

      {/* Карточки выбранных ходов */}
      {selectedMoveIds.map((mid) => {
        const m = allMoves.find((x) => x.id === mid);
        return m ? <MoveCard key={mid} move={m} /> : null;
      })}

      {/* Выбор стата + местный бонус — в одной строке */}
      {selectedMoveIds.length > 0 && needsRoll && (
        <div className="space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-wide">Стат броска</div>

          <div className="flex flex-wrap gap-2">
            {availableStats.map((sid) => {
              const score  = rawStats[sid] ?? 10;
              const mod    = statMods[sid] ?? 0;
              const active = statId === sid;
              const skill  = skillMap[sid];
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => patch({ stat_id: sid })}
                  className="rounded border px-3 py-2 min-w-[52px] text-xs font-mono transition-colors border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
                  style={active && skill ? {
                    borderColor:     skill.color,
                    backgroundColor: skill.color + "22",
                    color:           skill.color,
                  } : {}}
                >
                  <div className="text-center font-semibold">
                    {skill?.title ?? sid.toUpperCase()}
                  </div>
                  <div
                    className="text-center mt-0.5 font-semibold"
                    style={{ color: active && skill ? skill.color : "rgba(255,255,255,0.4)" }}
                  >
                    {mod >= 0 ? "+" : ""}{mod}
                  </div>
                  <div className="text-center text-white/20 text-[10px]">{score}</div>
                </button>
              );
            })}
          </div>

          {/* Местный бонус рядом со статами */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 uppercase tracking-wide shrink-0">Бонус</span>
            <LocalBonusInput
              value={localBonus}
              onChange={(v) => patch({ local_bonus: v })}
            />
            <span className="text-xs text-white/20">вперёд — на сервере</span>
          </div>
        </div>
      )}

      {/* Превью броска */}
      {needsRoll && statId && totalPreview !== null && (
        <div
          className="rounded border px-3 py-2 text-sm font-mono bg-zinc-950/30 flex items-center gap-1 flex-wrap"
          style={activeSkill ? { borderColor: activeSkill.color + "55" } : {}}
        >
          <span className="text-white/40">2d6</span>
          <span style={activeSkill ? { color: activeSkill.color } : { color: "rgba(255,255,255,0.6)" }}>
            {currentStatMod! >= 0 ? "+" : ""}{currentStatMod}
          </span>
          {localBonus !== 0 && (
            <span className={localBonus > 0 ? "text-emerald-300" : "text-red-300"}>
              {localBonus > 0 ? `+${localBonus}` : localBonus}
            </span>
          )}
          {aidBonus !== 0 && (
            <span className="text-emerald-300/70">+{aidBonus}</span>
          )}
          <span className="text-white/20 mx-1">→</span>
          <span
            className="font-bold"
            style={activeSkill ? { color: activeSkill.color } : { color: "rgba(255,255,255,0.8)" }}
          >
            2d6 {totalPreview >= 0 ? "+" : ""}{totalPreview}
          </span>
          {aidBonus !== 0 && (
            <span className="text-white/25 text-xs ml-1">(с помощью)</span>
          )}
        </div>
      )}

      {/* Подтвердить */}
      <button
        type="button"
        disabled={!valid}
        onClick={() => onSubmit({
          move_ids:          selectedMoveIds,
          stat_id:           statId || "",
          local_bonus:       localBonus,
          consume_bonus_ids: [],
        })}
        className={`rounded border px-3 py-2 text-sm font-semibold transition-colors
          ${valid
            ? "border-cyan-400/70 text-cyan-200 hover:bg-cyan-500/10"
            : "border-white/10 text-white/30 cursor-not-allowed"
          }`}
      >
        Подтвердить ход
      </button>
    </div>
  );
}