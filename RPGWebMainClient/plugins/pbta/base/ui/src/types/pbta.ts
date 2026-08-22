// base/ui/src/types/pbta.ts
// ─── Типы точно по бэковому контракту ───────────────────────────────────────
// Все имена полей соответствуют тому, что реально приходит с бэка.


// ── Skill ────────────────────────────────────────────────────────────────────

export type PbtaSkill = {
  id:    string;
  title: string;
  color: string;
};


// ── Move ─────────────────────────────────────────────────────────────────────

export type MoveKind = 'basic' | 'class' | 'advanced' | 'custom' | 'special' | 'gm' | 'race';

/** Условие срабатывания хода (бэк шлёт пустой объект если нет условия) */
export type MoveCondition = {
  requires_resource?:  string[];
  requires_context?:   string[];
  requires_moves?:     string[];
  forbidden_context?:  string[];
};

export type MovePlaceholderOption = {
  id: string;
  label: string;
};

export type MovePlaceholderKind = 'enum' | 'text' | 'move_pick';

export type MovePlaceholder = {
  id: string;
  label: string;
  kind?: MovePlaceholderKind;
  required?: boolean;
  options?: MovePlaceholderOption[];
  level_delta?: number;
};

export type Move = {
  id:    string;
  title: string;
  kind:  MoveKind;

  /** Теги хода: "attack", "melee", "ranged", "action", "help", "social", … */
  tags?: string[];

  condition?: MoveCondition;

  /** Статы, доступные для броска. Пустой массив = без броска. */
  available_stats: string[];

  summary?:     string;
  trigger?:     string;
  effect?:      string;
  effect_10_plus?: string;
  effect_7_9?:     string;
  effect_6_minus?: string;

  /** Плоские модификаторы ресурсов, которые ход может менять */
  resource_mods?: unknown[];
  /** Шаблоны ресурсов, которые ход может выдать */
  grant_resources?: MoveGrantResource[];
  /** Плоские модификаторы урона */
  damage_mods?:   unknown[];
  placeholders?: MovePlaceholder[];

  /** Ход творит заклинание — в declare доступен выбор подготовленного заклинания */
  casts_spell?: boolean;
};


export type MoveGrantResource = {
  spec_id: string;
  inline_spec?: ResourceSpec | null;
  amount?: number;
  on_tier?: string[];
  target?: string;
  filter_stats?: string[];
  filter_moves?: string[];
  filter_tags?: string[];
  description?: string;
};


// ── Playbook ─────────────────────────────────────────────────────────────────

export type PlaybookRaceOption = {
  id:      string;
  title:   string;
  move_id: string;
};

export type PlaybookAlignmentOption = {
  id:      string;
  title:   string;
  summary: string;
};

export type Playbook = {
  id:        string;
  title:     string;
  archetype: string;
  summary:   string;

  base_hp:    number;
  damage_die: string;   // "d6" | "d8" | "d10" | …
  base_load:  number;

  starting_moves: string[];
  /** Each group: pick exactly one at creation (DW barbarian armor, etc.). */
  starting_move_choices?: string[][];
  advanced_moves: string[];
  advanced_moves_6_10?: string[];

  races?:      PlaybookRaceOption[];
  alignments?: PlaybookAlignmentOption[];
};


// ── Resource spec ────────────────────────────────────────────────────────────

export type ResourceKind = 'bonus' | 'hold' | 'ammo' | string;
export type ResourceConsumeOn = 'roll' | 'manual' | 'apply' | string;

export type ResourceSpec = {
  id:                string;
  title:             string;
  kind:              ResourceKind;
  max_amount?:        number | null;
  consume_on?:        ResourceConsumeOn;
  expires_after_scene?: boolean;
  description?:      string;
};


// ── Spell ────────────────────────────────────────────────────────────────────

export type Spell = {
  id:          string;
  title:       string;
  level:       number;
  school?:     string;
  tags?:       string[];
  description: string;
  classes?:    string[];
};

export type SpellBook = {
  id:           string;
  title:        string;
  class_id:     string;
  levels?:      number[];
  summary?:     string;
  cantrip_note?: string;
};


// ── Custom move (на персонаже) ─────────────────────────────────────────────────

export type MoveTextOverride = {
  title?: string;
  summary?: string;
  trigger?: string;
  effect?: string;
  effect_10_plus?: string;
  effect_7_9?: string;
  effect_6_minus?: string;
};

export type CustomMove = {
  id:    string;
  title: string;
  available_stats: string[];
  tags?: string[];
  summary?:      string;
  trigger?:      string;
  effect?:       string;
  effect_10_plus?: string;
  effect_7_9?:     string;
  effect_6_minus?: string;
  grant_resources?: MoveGrantResource[];
};

export function customMoveToMove(cm: CustomMove): Move {
  return {
    id:    cm.id,
    title: cm.title,
    kind:  'custom',
    tags:  ['custom', ...(cm.tags ?? [])],
    available_stats: cm.available_stats ?? [],
    summary: cm.summary,
    trigger: cm.trigger,
    effect:  cm.effect,
    effect_10_plus: cm.effect_10_plus,
    effect_7_9:     cm.effect_7_9,
    effect_6_minus: cm.effect_6_minus,
    grant_resources: cm.grant_resources,
  };
}


// ── PbtaConfig (приходит в поле "pbta" конфига) ──────────────────────────────

export type PbtaConfig = {
  skills:       PbtaSkill[];
  moves:        Move[];
  playbooks:    Playbook[];
  /** Каталог ресурсов (бонусы, hold, заклинания, слоты и т.д.) */
  resource_specs?: ResourceSpec[];
  /** @deprecated — alias для resource_specs */
  resources?: ResourceSpec[];
  spells?:       Spell[];
  spell_books?:  SpellBook[];
};

/** Список спецификаций ресурсов из pbta-конфига (бэк шлёт resource_specs). */
export function getResourceSpecs(
  pbta?: Pick<PbtaConfig, 'resource_specs' | 'resources'> | null,
): ResourceSpec[] {
  return pbta?.resource_specs ?? pbta?.resources ?? [];
}


// ── Вспомогательный тип для UI (статы+модификаторы для одного хода) ──────────

export type MoveStatScore = {
  sid:   string;
  score: number;
  mod:   number;
};