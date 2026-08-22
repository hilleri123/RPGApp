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
