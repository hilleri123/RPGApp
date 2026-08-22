import { RoleAccess } from '@/app/services/types/access_groups';

const PERM_RANK: Record<string, number> = {
  [RoleAccess.READ_ROLE]: 1,
  [RoleAccess.EDIT_PARTIAL_ROLE]: 2,
  [RoleAccess.EDIT_FULL_ROLE]: 3,
  [RoleAccess.ALL_ROLE]: 4,
};

export function permissionRank(perm?: string | null): number {
  if (!perm) return 0;
  return PERM_RANK[perm] ?? 0;
}

export function hasAtLeast(perm: string | undefined | null, required: string): boolean {
  return permissionRank(perm) >= permissionRank(required);
}

export function canViewScenario(perm?: string | null): boolean {
  return hasAtLeast(perm ?? undefined, RoleAccess.READ_ROLE);
}

export function canCopyScenario(perm?: string | null): boolean {
  return hasAtLeast(perm ?? undefined, RoleAccess.READ_ROLE);
}

export function canEditEntities(perm?: string | null): boolean {
  return hasAtLeast(perm ?? undefined, RoleAccess.EDIT_PARTIAL_ROLE);
}

export function canEditScenarioMeta(perm?: string | null): boolean {
  return hasAtLeast(perm ?? undefined, RoleAccess.EDIT_FULL_ROLE);
}

export function canDeleteScenario(perm?: string | null): boolean {
  return hasAtLeast(perm ?? undefined, RoleAccess.ALL_ROLE);
}
