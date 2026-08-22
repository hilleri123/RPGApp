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

export function preparedLevelSum(data: CharacterData | null | undefined): number {
  const spells = data?.spellcasting?.spells ?? [];
  return spells.reduce((sum, s) => {
    if (!s?.prepared) return sum;
    const level = Number(s.level || 0);
    if (level <= 0) return sum;
    return sum + level * Math.max(1, Number(s.amount || 1));
  }, 0);
}
