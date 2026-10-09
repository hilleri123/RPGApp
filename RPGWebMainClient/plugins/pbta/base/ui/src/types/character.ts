import type { PbtaConfig } from './pbta';
import type { CustomMove, MoveTextOverride } from './pbta';


// ── Runtime state ─────────────────────────────────────────────────────────────

export type ActiveResource = {
  id:              string;
  spec_id:         string;
  amount:          number;
  source_move_id?: string;
  description?:    string;
};

export type CharacterState = {
  temp_bonuses?: ActiveResource[];
  hold?:         ActiveResource[]; // legacy
  resources?:    ActiveResource[];
};

export type CharacterSpellEntry = {
  id: string;
  spell_id?: string;
  title?: string;
  level?: number;
  prepared?: boolean;
  amount?: number;
  source?: 'codex' | 'custom' | 'other_playbook';
  notes?: string;
  school?: string;
  tags?: string[];
  description?: string;
  /** Не входит в сумму уровней и всегда подготовлено. */
  free?: boolean;
};

export type CharacterSpellcasting = {
  spells?: CharacterSpellEntry[];
};


// ── CharacterData — минимальный общий знаменатель для любой PbtA-игры ─────────

export type CharacterData = {
  playbook_id?:   string;
  moves:          string[];
  custom_moves?:  CustomMove[];
  stats:          Record<string, number>;
  stat_modifiers: Record<string, number>;
  state:          CharacterState;
  spellcasting?:  CharacterSpellcasting;
  /** move_id (codex) -> текстовые правки на листе */
  move_overrides?: Record<string, MoveTextOverride>;
  race_id?:          string;
  alignment_id?:     string;
  alignment_notes?:  string;
};

export type CharacterDataUpdater<T extends CharacterData = CharacterData> = (prev: T) => T;

export type CharacterDataChange<T extends CharacterData = CharacterData> = (
  next: T | CharacterDataUpdater<T>,
) => void;


// ── Constraints ───────────────────────────────────────────────────────────────

export type CharacterConstraints = {
  stat_min:    number;
  stat_max:    number;
  stat_arrays: number[][];
};


export type BaseInitialData = {
  playbook_id: string;
  moves:      string[];
  stats:      Record<string, number>;
  state:      CharacterState;
};


export type CharacterConfig<
  TInitial extends BaseInitialData = BaseInitialData,
  TConstraints extends CharacterConstraints = CharacterConstraints,
> = {
  pbta:        PbtaConfig;
  constraints: TConstraints;
  initialData: TInitial;
};


export function getPlaybookId(data: CharacterData): string {
  return data.playbook_id ?? '';
}

export function getStats(data: CharacterData): Record<string, number> {
  return data.stats ?? {};
}

/** Sum of forward + ongoing amounts. */
export function foResourceSum(data: CharacterData | null | undefined): number {
  const state = data?.state ?? {};
  let total = 0;
  for (const bucket of [state.temp_bonuses, state.resources] as const) {
    for (const raw of bucket ?? []) {
      if (!raw || (raw.spec_id !== 'forward' && raw.spec_id !== 'ongoing')) continue;
      total += Number(raw.amount || 0);
    }
  }
  return total;
}

export function listFoInstances(data: CharacterData | null | undefined): ActiveResource[] {
  const state = data?.state ?? {};
  const out: ActiveResource[] = [];
  for (const bucket of [state.temp_bonuses, state.resources] as const) {
    for (const raw of bucket ?? []) {
      if (!raw || (raw.spec_id !== 'forward' && raw.spec_id !== 'ongoing')) continue;
      if (Number(raw.amount || 0) <= 0) continue;
      out.push(raw);
    }
  }
  return out;
}

/** Уровень, который заклинание добавляет в сумму подготовки. Фокус и бесплатные — 0. */
export function spellPreparedLevelCost(s: CharacterSpellEntry | null | undefined): number {
  if (!s) return 0;
  if (s.free) return 0;
  if (String(s.school || '') === 'фокус') return 0;
  if (!s.prepared) return 0;
  const level = Number(s.level || 0);
  if (level <= 0) return 0;
  return level * Math.max(1, Number(s.amount || 1));
}

export function preparedLevelSum(data: CharacterData | null | undefined): number {
  const spells = data?.spellcasting?.spells ?? [];
  return spells.reduce((sum, s) => sum + spellPreparedLevelCost(s), 0);
}
