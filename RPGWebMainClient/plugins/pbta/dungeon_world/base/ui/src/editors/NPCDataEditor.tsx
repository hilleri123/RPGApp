'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type {
  NpcData, NpcConfig, NpcAttack, NpcMove,
  NpcGroupTag, NpcCharacterTag, NpcRangeTag, NpcAttackTag,
  TagMeta,
} from '../types/npc';
import type { ValidationIssue } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  data:     NpcData;
  config?:  NpcConfig;
  issues?:  ValidationIssue[];
  onChange: (next: NpcData) => void;
};

// ── helpers ───────────────────────────────────────────────────────────────────

function toggleArr<T extends string>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

function asInt(x: unknown, fb = 0): number {
  const n = parseInt(String(x), 10);
  return Number.isFinite(n) ? n : fb;
}

function isEmptyData(x: unknown): boolean {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return true;
  return Object.keys(x).length === 0;
}

const EMPTY_NPC: NpcData = {
  hp: 6, hp_current: 6, armor: 0,
  instinct: '',
  group_tags: [], nature_tags: [], special_qualities: [],
  attacks: [], moves: [],
};

const EMPTY_CFG: NpcConfig = {
  initialData:             EMPTY_NPC,
  group_tags:              [],
  nature_tags:             [],
  size_tags:               [],
  behavior_tags:           [],
  special_quality_presets: [],
  attack_tags:             [],
  range_tags:              [],
  damage_dice:             [],
};

// ── TagButton ─────────────────────────────────────────────────────────────────

function TagButton({ tag, active, onClick }: {
  tag: TagMeta; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={tag.hint}
      onClick={onClick}
      className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer
        ${active
          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
          : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
        }`}
    >
      {tag.label}
    </button>
  );
}

// ── TagGroup ──────────────────────────────────────────────────────────────────

function TagGroup<T extends string>({ label, tags, active, onToggle }: {
  label:    string;
  tags:     TagMeta[];
  active:   T[];
  onToggle: (id: T) => void;
}) {
  if (!tags.length) return null;
  return (
    <div className="space-y-1">
      <div className="text-white/50 text-xs">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <TagButton
            key={t.id}
            tag={t}
            active={active.includes(t.id as T)}
            onClick={() => onToggle(t.id as T)}
          />
        ))}
      </div>
    </div>
  );
}

// ── AttackEditor ──────────────────────────────────────────────────────────────

function AttackEditor({ attack, index, cfg, errMap, onChange, onRemove }: {
  attack:   NpcAttack;
  index:    number;
  cfg:      NpcConfig;
  errMap:   Map<string, string>;
  onChange: (a: NpcAttack) => void;
  onRemove: () => void;
}) {
  const err = (sub: string) => errMap.get(`attacks.${index}.${sub}`);

  const setAtk = (patch: Partial<NpcAttack>) =>
    onChange({ ...attack, ...patch });

  const dmgMatch = (attack.damage ?? '').match(/^([d\d]+)([+-]\d+)?$/);
  const dmgDice  = dmgMatch?.[1] ?? '';
  const dmgBonus = dmgMatch?.[2] ?? '';
  const buildDmg = (dice: string, bonus: string) => dice ? `${dice}${bonus}` : '';

  return (
    <div className="rounded border border-white/10 bg-black/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">Атака {index + 1}</div>
        <button type="button" onClick={onRemove}
          className="text-xs text-red-400/60 hover:text-red-400">✕ убрать</button>
      </div>

      <div className="space-y-1">
        <div className="text-white/50 text-xs">Название атаки</div>
        <Input
          value={attack.name}
          placeholder="Mandibles, Claws, Freezing Touch…"
          onChange={(e) => setAtk({ name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-white/50 text-xs">Кубик урона *</div>
          <select
            className="w-full rounded border bg-zinc-950/30 px-2 py-1.5 text-xs text-gray-100"
            value={dmgDice}
            onChange={(e) => setAtk({ damage: buildDmg(e.target.value, dmgBonus) })}
          >
            <option value="">— выбери —</option>
            {cfg.damage_dice.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {err('damage') && <div className="text-xs text-red-400">{err('damage')}</div>}
        </div>
        <div className="space-y-1">
          <div className="text-white/50 text-xs">Бонус</div>
          <select
            className="w-full rounded border bg-zinc-950/30 px-2 py-1.5 text-xs text-gray-100"
            value={dmgBonus}
            onChange={(e) => setAtk({ damage: buildDmg(dmgDice, e.target.value) })}
          >
            <option value="">—</option>
            {['-2', '-1', '+1', '+2', '+3', '+4'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {attack.damage && (
        <div className="text-xs text-white/30 font-mono">
          {attack.name || 'Атака'} ({attack.damage} damage
          {attack.range_tags.length  ? `, ${attack.range_tags.join(', ')}`  : ''}
          {attack.attack_tags.length ? `, ${attack.attack_tags.join(', ')}` : ''})
        </div>
      )}

      <TagGroup<NpcRangeTag>
        label="Дальность *"
        tags={cfg.range_tags}
        active={attack.range_tags}
        onToggle={(id) => setAtk({ range_tags: toggleArr(attack.range_tags, id) })}
      />
      {err('range_tags') && <div className="text-xs text-red-400">{err('range_tags')}</div>}

      <TagGroup<NpcAttackTag>
        label="Теги атаки"
        tags={cfg.attack_tags}
        active={attack.attack_tags}
        onToggle={(id) => setAtk({ attack_tags: toggleArr(attack.attack_tags, id) })}
      />
    </div>
  );
}

// ── MoveEditor ────────────────────────────────────────────────────────────────

function MoveEditor({ move, index, onChange, onRemove }: {
  move:     NpcMove;
  index:    number;
  onChange: (m: NpcMove) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">Ход {index + 1}</div>
        <button type="button" onClick={onRemove}
          className="text-xs text-red-400/60 hover:text-red-400">✕</button>
      </div>
      <Input
        value={move.title}
        placeholder="Название хода…"
        onChange={(e) => onChange({ ...move, title: e.target.value })}
      />
      <textarea
        className="w-full rounded border bg-zinc-950/30 px-2 py-1.5 text-xs text-gray-100 resize-none"
        rows={2}
        placeholder="Описание эффекта…"
        value={move.description}
        onChange={(e) => onChange({ ...move, description: e.target.value })}
      />
    </div>
  );
}

// ── Основной редактор ─────────────────────────────────────────────────────────

export default function NpcDataEditor({ data, config, issues, onChange }: Props) {
  const initKeyRef = useRef<string | null>(null);
  const cfg = config ?? EMPTY_CFG;

  useEffect(() => {
    const init = cfg.initialData;
    if (initKeyRef.current === 'npc') return;
    if (!isEmptyData(data)) { initKeyRef.current = 'npc'; return; }
    initKeyRef.current = 'npc';
    onChange(structuredClone(init));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const v: NpcData = (data && typeof data === 'object' ? data : EMPTY_NPC) as NpcData;

  const hp         = v.hp          ?? 6;
  const hpCurrent  = v.hp_current  ?? hp;
  const armor      = v.armor       ?? 0;
  const instinct   = v.instinct    ?? '';
  const attacks    = v.attacks     ?? [];
  const moves      = v.moves       ?? [];
  const groupTags  = v.group_tags  ?? [];
  const natureTags = v.nature_tags ?? [];
  const specials   = v.special_qualities ?? [];

  const errMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues ?? []) {
      const p = i.path.startsWith('data.') ? i.path.slice(5) : i.path;
      m.set(p, i.message);
    }
    return m;
  }, [issues]);

  const getErr  = (p: string) => errMap.get(p);
  const getWarn = (p: string) =>
    issues?.find((i) => (i.path.endsWith(p)) && i.icon === 'warning')?.message;

  const set = (patch: Partial<NpcData>) =>
    onChange({ ...structuredClone(v), ...patch });

  // nature + size + behavior → одна корзина на фронте
  const allNatureTagMeta: TagMeta[] = [
    ...cfg.nature_tags,
    ...cfg.size_tags,
    ...cfg.behavior_tags,
  ];

  // preset ids для special_qualities
  const presetIds = new Set(cfg.special_quality_presets.map((p) => p.id));
  const customSpecials = specials.filter((s) => !presetIds.has(s));
  const presetSpecials = specials.filter((s) =>  presetIds.has(s));

  return (
    <div className="space-y-4 text-sm">

      {/* ── HP / Armor ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <div className="text-white/60">HP макс.</div>
          <Input
            type="number" min={1} value={hp}
            onChange={(e) => {
              const n = Math.max(1, asInt(e.target.value));
              set({ hp: n, hp_current: Math.min(hpCurrent, n) });
            }}
          />
          {getErr('hp') && <div className="text-xs text-red-400">{getErr('hp')}</div>}
        </div>
        <div className="space-y-1">
          <div className="text-white/60">HP текущий</div>
          <Input
            type="number" min={0} max={hp} value={hpCurrent}
            onChange={(e) => set({ hp_current: Math.min(hp, Math.max(0, asInt(e.target.value))) })}
          />
        </div>
        <div className="space-y-1">
          <div className="text-white/60">Armor</div>
          <Input
            type="number" min={0} max={10} value={armor}
            onChange={(e) => set({ armor: Math.max(0, asInt(e.target.value)) })}
          />
        </div>
      </div>

      {/* HP bar */}
      <div className="rounded-full bg-white/5 h-2 overflow-hidden">
        <div
          className="h-full bg-green-500/60 transition-all"
          style={{ width: hp > 0 ? `${Math.round((hpCurrent / hp) * 100)}%` : '0%' }}
        />
      </div>

      {/* ── Instinct ──────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="text-white/60">
          Instinct
          <span className="text-white/30 ml-1 text-xs">— главная мотивация</span>
        </div>
        <Input
          value={instinct}
          placeholder="To consume all warmth / To protect its lair…"
          onChange={(e) => set({ instinct: e.target.value })}
          className={getWarn('instinct') ? 'border-yellow-500/50' : undefined}
        />
        {getWarn('instinct') && (
          <div className="text-xs text-yellow-400/70">⚠ {getWarn('instinct')}</div>
        )}
      </div>

      {/* ── Масштаб ───────────────────────────────────────────────────── */}
      <TagGroup<NpcGroupTag>
        label="Масштаб"
        tags={cfg.group_tags}
        active={groupTags}
        onToggle={(id) => set({ group_tags: toggleArr(groupTags, id) })}
      />

      {/* ── Природа / размер / поведение ─────────────────────────────── */}
      <TagGroup<NpcCharacterTag>
        label="Природа и поведение"
        tags={allNatureTagMeta}
        active={natureTags}
        onToggle={(id) => set({ nature_tags: toggleArr(natureTags, id) })}
      />

      {/* ── Special Qualities ─────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="text-white/60">Special Qualities</div>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {cfg.special_quality_presets.map((t) => (
            <TagButton
              key={t.id} tag={t}
              active={presetSpecials.includes(t.id)}
              onClick={() => set({
                special_qualities: toggleArr(specials, t.id),
              })}
            />
          ))}
        </div>
        <Input
          value={customSpecials.join(', ')}
          placeholder="Свои особые качества через запятую…"
          onChange={(e) => {
            const custom = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
            set({ special_qualities: [...presetSpecials, ...custom] });
          }}
        />
      </div>

      {/* ── Атаки ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-white/60">Атаки</div>
          <button
            type="button"
            onClick={() => set({
              attacks: [...attacks, { name: '', damage: '', range_tags: [], attack_tags: [] }],
            })}
            className="text-xs text-indigo-400/70 hover:text-indigo-400 border
                       border-indigo-400/20 rounded px-2 py-0.5"
          >+ добавить атаку</button>
        </div>

        {attacks.map((atk, i) => (
          <AttackEditor
            key={i}
            attack={atk}
            index={i}
            cfg={cfg}
            errMap={errMap}
            onChange={(updated) => {
              const arr = [...attacks];
              arr[i] = updated;
              set({ attacks: arr });
            }}
            onRemove={() => {
              const arr = [...attacks];
              arr.splice(i, 1);
              set({ attacks: arr });
            }}
          />
        ))}
        {attacks.length === 0 && (
          <div className="text-xs text-white/25 italic">Нет атак — добавь хотя бы одну</div>
        )}
      </div>

      {/* ── Ходы мастера ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-white/60">
            Ходы мастера
            <span className="text-white/30 ml-1 text-xs">1-3 штуки</span>
          </div>
          <button
            type="button"
            onClick={() => set({
              moves: [...moves, { id: crypto.randomUUID(), title: '', description: '', is_hard: false }],
            })}
            className="text-xs text-indigo-400/70 hover:text-indigo-400 border
                       border-indigo-400/20 rounded px-2 py-0.5"
          >+ добавить ход</button>
        </div>

        {moves.map((mv, i) => (
          <MoveEditor
            key={mv.id ?? i}
            move={mv}
            index={i}
            onChange={(updated) => {
              const arr = [...moves];
              arr[i] = updated;
              set({ moves: arr });
            }}
            onRemove={() => {
              const arr = [...moves];
              arr.splice(i, 1);
              set({ moves: arr });
            }}
          />
        ))}
        {moves.length === 0 && (
          <div className="text-xs text-white/25 italic">
            Нет ходов — добавь 1-3 нарративных хода мастера
          </div>
        )}
      </div>

    </div>
  );
}