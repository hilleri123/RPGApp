import { RuleTemplatesApiService } from './api/templates';
import type { EntityKind } from './types2';
import { getCachedPluginSchema, setCachedPluginSchema } from './pluginSchemaCache';

/** Kinds used by template / entity-pack editor dialogs. */
export const TEMPLATE_SET_PLUGIN_ENTITY_KINDS: EntityKind[] = ['character', 'npc', 'item'];

const inflight = new Map<string, Promise<void>>();

export async function preloadTemplateSetPluginSchemas(templateSetId: string): Promise<void> {
  if (!templateSetId) return;

  const existing = inflight.get(templateSetId);
  if (existing) return existing;

  const job = (async () => {
    const api = new RuleTemplatesApiService(templateSetId);
    const scope = { scope: 'template_set' as const, id: templateSetId };

    await Promise.all(
      TEMPLATE_SET_PLUGIN_ENTITY_KINDS.map(async (entity) => {
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
    inflight.delete(templateSetId);
  });

  inflight.set(templateSetId, job);
  return job;
}
