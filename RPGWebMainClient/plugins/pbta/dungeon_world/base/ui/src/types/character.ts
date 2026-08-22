export type {
  CharacterState,
  CharacterConstraints,
  ActiveResource,
  BaseInitialData,
} from '../../../../../base/ui/src/types/character';

export type {
  PbtaSkill,
  Move,
  Playbook,
  PbtaConfig,
  ResourceSpec,
  MoveStatScore,
} from '../../../../../base/ui/src/types/pbta';

export { getResourceSpecs } from '../../../../../base/ui/src/types/pbta';

import type {
  CharacterData as BaseCharacterData,
  CharacterConfig,
  CharacterConstraints,
  BaseInitialData,
  CharacterState,
} from '../../../../../base/ui/src/types/character';


// ── DW-специфика поверх базового CharacterData ────────────────────────────────
// hp, уровень, опыт, броня — только в DW, не в базовом PbtA

export type CharacterData = BaseCharacterData & {
  hp:          number;
  max_hp?:     number;   // saved data
  maxhp?:      number;   // initialData от бэка
  level:       number;
  xp:          number;
  armor_cache: number;
};


// ── DW initialData — то, что бэк шлёт в config.initialData ───────────────────

export type DWInitialData = BaseInitialData & {
  hp:          number;
  maxhp:       number;
  level:       number;
  xp:          number;
  armor_cache?: number;
  // В initialData бэк шлёт pbtaskills, а не stats —
  // поэтому переопределяем stats как optional и добавляем pbtaskills
  pbtaskills:  Record<string, number>;
};


// ── DW CharacterConfig ────────────────────────────────────────────────────────

export type DWCharacterConfig = CharacterConfig<DWInitialData, CharacterConstraints>;


// ── Хелперы для DW CharacterData ─────────────────────────────────────────────

export function getMaxHp(data: CharacterData): number {
  return data.max_hp ?? data.maxhp ?? 0;
}

export function getPbtaSkills(data: CharacterData): Record<string, number> {
  // saved data хранит в stats, initialData шлёт в pbtaskills
  return data.stats ?? (data as any).pbtaskills ?? {};
}

export function getPlaybookId(data: CharacterData): string {
  return data.playbook_id ?? data.playbook_id ?? '';
}