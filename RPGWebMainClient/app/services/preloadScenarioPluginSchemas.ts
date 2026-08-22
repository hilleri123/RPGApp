import { ScenarioScopedApiService } from './api/scenario_scoped';
import type { EntityKind } from './types2';
import { getCachedPluginSchema, setCachedPluginSchema } from './pluginSchemaCache';

/** Entity kinds used by scenario editor dialogs (schemas are static per scenario). */
export const SCENARIO_PLUGIN_ENTITY_KINDS: EntityKind[] = [
  'character',
  'npc',
  'item',
  'location',
  'obstacle',
  'scene',
];

const inflight = new Map<string, Promise<void>>();

export async function preloadScenarioPluginSchemas(scenarioId: string): Promise<void> {
  const existing = inflight.get(scenarioId);
  if (existing) return existing;

  const job = (async () => {
    const api = new ScenarioScopedApiService(scenarioId);
    const scope = { scope: 'scenario' as const, id: scenarioId };

    await Promise.all(
      SCENARIO_PLUGIN_ENTITY_KINDS.map(async (entity) => {
        if (getCachedPluginSchema(scope, entity)?.schema) return;

        const res = await api.getEntitySchema(entity);
        if (res.schema) {
          setCachedPluginSchema(scope, entity, {
            schema: res.schema,
            etag: res.etag,
          });
        }
      }),
    );
  })().finally(() => {
    inflight.delete(scenarioId);
  });

  inflight.set(scenarioId, job);
  return job;
}
