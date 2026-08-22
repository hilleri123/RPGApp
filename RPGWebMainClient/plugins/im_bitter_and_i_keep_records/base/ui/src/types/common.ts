// common.ts
export type EntityKind = 'character' | 'npc' | 'item' | 'location' | 'obstacle'; // obstacle пока справочник

export type ValidationIssueLevel = 'error' | 'warning';

export type ValidationIssue = {
  path: string; // "data.tags.0" or "data.tracks.hp"
  message: string;
  icon?: string;
  level?: ValidationIssueLevel;
};

export type ValidateResult<T> = {
  ok: boolean;
  issues: ValidationIssue[];
  data: T | null;
};

export type TagCategory = 'technique' | 'material' | 'tactic';

export type TagDef = {
  id: string;
  category: TagCategory;
  title: string;
  description?: string;
};

export type PassiveDef = {
  id: string;
  title: string;
  description?: string;
  requiredTags?: string[];
  grantsTags?: string[];
  obsession?: any;
};

export type PassiveState = {
  id: string;
  enabled?: boolean;
  meta?: Record<string, any>;
};


export type Economy = {
  main?: number;
  move?: number;
  defense?: number;
};

export type MasteryRules = {
  noviceAt: number;
  trainedAt?: number; // optional
  masterAt?: number;  // optional
  legendAt?: number;  // optional
  note?: string;
};