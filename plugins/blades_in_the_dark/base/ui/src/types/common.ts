export type EntityKind = 'character' | 'npc' | 'item' | 'location' | 'obstacle';

export type ValidationIssueLevel = 'error' | 'warning';

export type ValidationIssue = {
  path: string;     // "data.skills.athletics"
  message: string;
  icon?: string;    // "error" | "warn" | "dice"...
  level?: ValidationIssueLevel; // default "error" на бэке
};

export type ValidateResult<T = any> = {
  ok: boolean;
  issues: ValidationIssue[];
  data: T | null;
};
