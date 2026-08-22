export type SeenDataAccess = 'none' | 'full';

export interface PlayerSeenEntry {
  entity_type: string;
  entity_id: string;
  data_access: SeenDataAccess;
}

export function resolveSeenDataAccess(
  playerSeen: PlayerSeenEntry[] | undefined,
  entityType: string,
  entity: { id: string; copied_from?: string | null },
): SeenDataAccess {
  const canonical = String(entity.copied_from ?? entity.id);
  const entry = (playerSeen ?? []).find(
    (row) => row.entity_type === entityType && String(row.entity_id) === canonical,
  );
  return entry?.data_access ?? 'none';
}

export function isEntityDataRevealed(
  dataRevealed: PlayerSeenEntry[] | undefined,
  entityType: string,
  entity: { id: string; copied_from?: string | null },
): boolean {
  const canonical = String(entity.copied_from ?? entity.id);
  return (dataRevealed ?? []).some(
    (row) => row.entity_type === entityType && String(row.entity_id) === canonical,
  );
}
