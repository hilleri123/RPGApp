"use client";
import React, { useState } from "react";
import { Dices, Plus, Trash2, CheckCircle2, Sparkles } from "lucide-react";
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
  type OutcomeKind,
} from "../types";
import { MoveCard } from "../components/MoveCard";

// ── Типы ──────────────────────────────────────────────────────────────────────

type ResolveStageProps = {
  action:           PerformMoveAction;
  value:            Record<string, unknown>;
  patch:            (next: Record<string, unknown>) => void;
  onSubmit:         (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

// Назначение ресурса (локальный стейт до применения)
type ResourceAssignment = {
  id:                  string;   // локальный uuid
  spec_id:             string;
  label:               string;
  kind:                "add" | "remove" | "set" | "clear";
  amount:              number;
  target_character_id: string;
  source_move_id:      string;   // "" если ручной
  filter_stats:        string[];
  filter_moves:        string[];
};

// Фабрика — то что можно назначить
type ResourceFactory = {
  id:           string;   // spec_id или "custom_N"
  spec_id:      string;
  label:        string;
  kind:         "add" | "remove" | "set" | "clear";
  amount:       number;
  source_move_id: string;
  source_move_title: string;
  filter_stats: string[];
  filter_moves: string[];
  from_move:    boolean;
};

// Захардкоженные спеки ресурсов
const RESOURCE_SPECS: Array<{ id: string; label: string; defaultAmount: number }> = [
  { id: "hold",    label: "Hold",        defaultAmount: 1 },
  { id: "forward", label: "+1 вперёд",   defaultAmount: 1 },
  { id: "ongoing", label: "Ongoing +1",  defaultAmount: 1 },
  { id: "armor",   label: "Броня",       defaultAmount: 1 },
  { id: "ammo",    label: "Патроны",     defaultAmount: 3 },
  { id: "use",     label: "Использование", defaultAmount: 1 },
  { id: "flag",    label: "Флаг",        defaultAmount: 1 },
];

// ── Утилиты ───────────────────────────────────────────────────────────────────

function outcomeStyle(outcome: OutcomeKind | null | undefined) {
  if (outcome === "hit_10_plus") return { color: "#86efac", border: "rgba(134,239,172,0.3)", bg: "rgba(134,239,172,0.07)", label: "10+ Успех" };
  if (outcome === "hit_7_9")     return { color: "#fcd34d", border: "rgba(252,211,77,0.3)",  bg: "rgba(252,211,77,0.07)",  label: "7–9 Частичный успех" };
  return                                { color: "#fca5a5", border: "rgba(252,165,165,0.3)", bg: "rgba(252,165,165,0.07)", label: "6− Провал" };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// on_tier совпадает с outcome?
function tierMatches(onTier: string[], outcome: string | null | undefined): boolean {
  if (!onTier || onTier.length === 0) return true;
  if (!outcome) return false;
  if (onTier.includes("any")) return true;
  if (onTier.includes("any_hit") && (outcome === "hit_10_plus" || outcome === "hit_7_9")) return true;
  if (onTier.includes("10_plus") && outcome === "hit_10_plus") return true;
  if (onTier.includes("7_9")     && outcome === "hit_7_9")     return true;
  if (onTier.includes("6_minus") && outcome === "miss_6_minus") return true;
  return false;
}

// ── DicePips ──────────────────────────────────────────────────────────────────

function DicePips({ value }: { value: number }) {
  const pip: Record<number, number[]> = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
  const active = new Set(pip[value] ?? []);
  return (
    <div className="grid grid-cols-3 gap-[3px] p-1.5 w-9 h-9 rounded-md bg-zinc-800 border border-white/10">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-full" style={{ width:5, height:5, backgroundColor: active.has(i) ? "rgba(255,255,255,0.85)" : "transparent", margin:"auto" }} />
      ))}
    </div>
  );
}

// ── ResourceFactoryCard ───────────────────────────────────────────────────────

function ResourceFactoryCard({ factory, selected, onClick }: {
  factory:  ResourceFactory;
  selected: boolean;
  onClick:  () => void;
}) {
  const kindColor = factory.kind === "remove" ? "#fca5a5" : factory.kind === "add" ? "#86efac" : "#fcd34d";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded border px-2.5 py-2 text-xs transition-all"
      style={{
        borderColor:     selected ? kindColor : "rgba(255,255,255,0.1)",
        backgroundColor: selected ? kindColor + "15" : "rgba(255,255,255,0.02)",
        boxShadow:       selected ? `0 0 0 1px ${kindColor}66` : "none",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-white/80">{factory.label}</span>
        <span className="font-mono shrink-0" style={{ color: kindColor }}>
          {factory.kind === "add" ? "+" : factory.kind === "remove" ? "−" : "="}{factory.amount}
        </span>
      </div>
      {factory.source_move_title && (
        <div className="text-[10px] text-white/25 mt-0.5 truncate">
          из «{factory.source_move_title}»
        </div>
      )}
      {factory.filter_stats.length > 0 && (
        <div className="text-[10px] text-white/20 mt-0.5">
          статы: {factory.filter_stats.join(", ")}
        </div>
      )}
    </button>
  );
}

// ── CharacterContainer ────────────────────────────────────────────────────────

function CharacterContainer({ character, assignments, selectedFactory, onAssign, onRemove }: {
  character:       any;
  assignments:     ResourceAssignment[];
  selectedFactory: ResourceFactory | null;
  onAssign:        (charId: string) => void;
  onRemove:        (id: string) => void;
}) {
  const isTarget = !!selectedFactory;
  const myAssignments = assignments.filter((a) => a.target_character_id === String(character.id));

  return (
    <div
      className="rounded border p-2.5 transition-all cursor-default"
      style={{
        borderColor:     isTarget ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.08)",
        backgroundColor: isTarget ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.01)",
      }}
      onClick={() => { if (selectedFactory) onAssign(String(character.id)); }}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/80">{character.name}</span>
        {isTarget && (
          <span className="text-[10px] text-cyan-300/70 border border-cyan-300/30 rounded px-1.5 py-0.5">
            нажми чтобы назначить
          </span>
        )}
      </div>

      {/* Назначенные ресурсы */}
      {myAssignments.length === 0 ? (
        <div className="text-[11px] text-white/15 text-center py-2">
          {isTarget ? "↑ выбери и нажми" : "нет назначений"}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {myAssignments.map((a) => {
            const kindColor = a.kind === "remove" ? "#fca5a5" : a.kind === "add" ? "#86efac" : "#fcd34d";
            return (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono"
                style={{ backgroundColor: kindColor + "20", color: kindColor, border: `1px solid ${kindColor}40` }}
              >
                {a.label} {a.kind === "add" ? "+" : a.kind === "remove" ? "−" : "="}{a.amount}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(a.id); }}
                  className="ml-0.5 opacity-40 hover:opacity-90 transition-opacity"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CustomFactoryForm ─────────────────────────────────────────────────────────

function CustomFactoryForm({ onAdd }: { onAdd: (f: ResourceFactory) => void }) {
  const [open,   setOpen]   = useState(false);
  const [specId, setSpecId] = useState("hold");
  const [kind,   setKind]   = useState<"add" | "remove" | "set">("add");
  const [amount, setAmount] = useState(1);

  const spec = RESOURCE_SPECS.find((s) => s.id === specId) ?? RESOURCE_SPECS[0];

  if (!open) return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full flex items-center justify-center gap-1.5 rounded border border-dashed border-white/10 py-2 text-xs text-white/30 hover:text-white/50 hover:border-white/20 transition-colors"
    >
      <Plus className="w-3 h-3" /> свой ресурс
    </button>
  );

  return (
    <div className="rounded border border-white/15 bg-zinc-950/40 p-2.5 space-y-2">
      <div className="text-[10px] text-white/30 uppercase tracking-wide">Ручной ресурс</div>

      {/* Выбор спека */}
      <select
        value={specId}
        onChange={(e) => setSpecId(e.target.value)}
        className="w-full rounded border border-white/10 bg-zinc-900 text-xs text-white/70 px-2 py-1.5 outline-none"
      >
        {RESOURCE_SPECS.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      <div className="flex gap-2">
        {/* kind */}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as any)}
          className="flex-1 rounded border border-white/10 bg-zinc-900 text-xs text-white/70 px-2 py-1.5 outline-none"
        >
          <option value="add">Добавить</option>
          <option value="remove">Убрать</option>
          <option value="set">Установить</option>
        </select>

        {/* amount */}
        <input
          type="number"
          min={1}
          max={10}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
          className="w-14 rounded border border-white/10 bg-zinc-900 text-xs text-white/70 px-2 py-1.5 text-center outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onAdd({
              id:                `custom_${uid()}`,
              spec_id:           specId,
              label:             spec.label,
              kind,
              amount,
              source_move_id:    "",
              source_move_title: "",
              filter_stats:      [],
              filter_moves:      [],
              from_move:         false,
            });
            setOpen(false);
          }}
          className="flex-1 rounded border border-cyan-400/40 text-cyan-300 text-xs py-1.5 hover:bg-cyan-500/10 transition-colors"
        >
          Добавить
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-white/10 text-white/30 text-xs px-3 py-1.5 hover:border-white/20 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export function PerformMoveResolveStage({
  action, onSubmit, setSubmitEnabled,
}: ResolveStageProps) {
  React.useEffect(() => { setSubmitEnabled(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { scene }  = getSceneBundle(action);
  const entry      = action.workflow.context.entry as PerformMoveEntry;
  const roll       = entry.roll;
  const skills     = entry.skills ?? [] as SkillConfig[];
  const skillMap   = Object.fromEntries(skills.map((s) => [s.id, s]));

  const allMoves      = parseMovesFromStageData(action) as MoveLite[];
  const selectedIds   = (entry.moves ?? []).map((m: any) => m.id);
  const selectedMoves = selectedIds.map((id) => allMoves.find((m) => m.id === id)).filter(Boolean) as MoveLite[];

  const statSkill = roll.stat_id ? skillMap[roll.stat_id] : undefined;
  const os        = outcomeStyle(roll.outcome);

  // ── Фабрики из ходов ──────────────────────────────────────────────────────

  const moveFactories: ResourceFactory[] = React.useMemo(() => {
    const result: ResourceFactory[] = [];
    for (const m of selectedMoves) {
      const mods: any[] = (m as any).resource_mods ?? [];
      for (const mod of mods) {
        if (!tierMatches(mod.on_tier ?? [], roll.outcome)) continue;
        const spec = RESOURCE_SPECS.find((s) => s.id === mod.spec_id);
        result.push({
          id:                `${m.id}_${mod.spec_id}_${uid()}`,
          spec_id:           mod.spec_id,
          label:             spec?.label ?? mod.spec_id,
          kind:              mod.kind ?? "add",
          amount:            mod.amount ?? 1,
          source_move_id:    m.id,
          source_move_title: m.title,
          filter_stats:      mod.filter_stats ?? [],
          filter_moves:      mod.filter_moves ?? [],
          from_move:         true,
        });
      }
    }
    return result;
  }, [selectedIds.join(","), roll.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const [customFactories, setCustomFactories] = useState<ResourceFactory[]>([]);
  const allFactories = [...moveFactories, ...customFactories];

  // ── Стейт выбора и назначений ─────────────────────────────────────────────

  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const [assignments, setAssignments]             = useState<ResourceAssignment[]>([]);

  const selectedFactory = allFactories.find((f) => f.id === selectedFactoryId) ?? null;

  const handleFactoryClick = (f: ResourceFactory) => {
    setSelectedFactoryId((prev) => prev === f.id ? null : f.id);
  };

  const handleAssign = (charId: string) => {
    if (!selectedFactory) return;
    setAssignments((prev) => [...prev, {
      id:                  uid(),
      spec_id:             selectedFactory.spec_id,
      label:               selectedFactory.label,
      kind:                selectedFactory.kind,
      amount:              selectedFactory.amount,
      target_character_id: charId,
      source_move_id:      selectedFactory.source_move_id,
      filter_stats:        selectedFactory.filter_stats,
      filter_moves:        selectedFactory.filter_moves,
    }]);
    // Не сбрасываем выбор — можно назначить тому же ресурсу нескольким
  };

  const handleRemove = (id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const characters = scene?.characters ?? [];

  // ── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded border border-white/10 p-3 flex flex-col gap-4">

      {/* Заголовок */}
      <div className="font-medium flex items-center gap-2">
        <Dices className="w-4 h-4 text-cyan-300" />
        Результат броска
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

      {/* Бросок */}
      <div className="rounded border p-3 flex flex-col gap-3" style={{ borderColor: os.border, backgroundColor: os.bg }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: os.color }}>{os.label}</span>
          <span className="text-xs font-mono text-white/30">{roll.result_text}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {roll.dice.map((d, i) => <DicePips key={i} value={d} />)}
          </div>
          <div className="flex items-center gap-1 text-sm font-mono flex-wrap">
            <span className="text-white/40">{roll.dice.reduce((a, b) => a + b, 0)}</span>
            {roll.base_modifier !== 0 && (
              <span style={{ color: statSkill?.color ?? "rgba(255,255,255,0.6)" }}>
                {roll.base_modifier >= 0 ? "+" : ""}{roll.base_modifier}
                {statSkill && <span className="text-xs ml-0.5 opacity-60">({statSkill.title})</span>}
              </span>
            )}
            {roll.local_bonus !== 0 && (
              <span className={roll.local_bonus > 0 ? "text-emerald-300" : "text-red-300"}>
                {roll.local_bonus > 0 ? "+" : ""}{roll.local_bonus}
              </span>
            )}
            {roll.aid_bonus !== 0 && (
              <span className="text-emerald-300/70">+{roll.aid_bonus}<span className="text-xs ml-0.5 opacity-60">(помощь)</span></span>
            )}
            <span className="text-white/20 mx-1">=</span>
            <span className="font-bold text-base" style={{ color: os.color }}>{roll.total}</span>
          </div>
        </div>
      </div>

      {/* Ходы */}
      {selectedMoves.map((m) => (
        <MoveCard
          key={m.id}
          move={m}
          outcome={roll.outcome}
          resultText={m.id === selectedIds[0] ? roll.result_text : null}
        />
      ))}

      {/* Распределение ресурсов */}
      <div className="space-y-2">
        <div className="text-xs text-white/30 uppercase tracking-wide flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Распределение ресурсов
          {selectedFactory && (
            <span className="text-cyan-300/70 normal-case">
              — выбрано: «{selectedFactory.label}», нажми на персонажа
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Левая колонка — фабрики */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-white/20 uppercase tracking-wide mb-1">Фабрики</div>

            {allFactories.length === 0 && (
              <div className="text-[11px] text-white/15 py-2 text-center">
                Нет автоматических ресурсов для этого исхода
              </div>
            )}

            {allFactories.map((f) => (
              <ResourceFactoryCard
                key={f.id}
                factory={f}
                selected={selectedFactoryId === f.id}
                onClick={() => handleFactoryClick(f)}
              />
            ))}

            <CustomFactoryForm
              onAdd={(f) => {
                setCustomFactories((prev) => [...prev, f]);
                setSelectedFactoryId(f.id);
              }}
            />
          </div>

          {/* Правая колонка — персонажи */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-white/20 uppercase tracking-wide mb-1">Персонажи</div>
            {characters.length === 0 && (
              <div className="text-[11px] text-white/15 py-2 text-center">Нет персонажей в сцене</div>
            )}
            {characters.map((ch: any) => (
              <CharacterContainer
                key={ch.id}
                character={ch}
                assignments={assignments}
                selectedFactory={selectedFactory}
                onAssign={handleAssign}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Применить */}
      <button
        type="button"
        onClick={() => onSubmit({
          confirmed:   true,
          assignments: assignments.map((a) => ({
            spec_id:             a.spec_id,
            kind:                a.kind,
            amount:              a.amount,
            target_character_id: a.target_character_id,
            source_move_id:      a.source_move_id,
            filter_stats:        a.filter_stats,
            filter_moves:        a.filter_moves,
          })),
        })}
        className="rounded border border-cyan-400/70 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10 transition-colors flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-4 h-4" />
        Применить результат
      </button>
    </div>
  );
}