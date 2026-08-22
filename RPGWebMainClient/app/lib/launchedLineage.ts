import type { Scenario } from '@/app/services/types2';

export type LineageEntity = {
  source_entity_id?: string | null;
};

/** Объекты, скопированные из prep при запуске, нельзя удалять из launched-сценария. */
export function isLineageProtectedEntity(
  scenario: Pick<Scenario, 'is_session_snapshot'> | null | undefined,
  item: LineageEntity | null | undefined,
): boolean {
  return Boolean(scenario?.is_session_snapshot && item?.source_entity_id);
}
