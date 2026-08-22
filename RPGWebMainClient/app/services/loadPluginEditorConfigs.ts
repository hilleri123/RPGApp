import type { EntityKind } from './types2';
import {
  buildEditorConfig,
  getCachedPluginSchema,
  getOrFetchPluginOptions,
  setCachedPluginSchema,
  type PluginSchemaScope,
} from './pluginSchemaCache';

type SchemaFetcher = (
  entity: EntityKind,
  etag?: string,
) => Promise<{ schema: any; etag?: string; notModified: boolean }>;

type InitFetcher = (entity: EntityKind, context: Record<string, any>) => Promise<any>;
type OptionsFetcher = (entity: EntityKind, context: Record<string, any>) => Promise<any>;

export async function loadPluginEditorConfigs(opts: {
  scope: PluginSchemaScope;
  kinds: EntityKind[];
  fetchSchema: SchemaFetcher;
  fetchInit?: InitFetcher;
  fetchOptions?: OptionsFetcher;
  needInit: boolean;
  initContext?: Record<string, any>;
  optionsContext?: Record<string, any>;
}): Promise<Partial<Record<EntityKind, any>>> {
  const {
    scope,
    kinds,
    fetchSchema,
    fetchInit,
    fetchOptions,
    needInit,
    initContext = {},
    optionsContext = {},
  } = opts;

  const dict: Partial<Record<EntityKind, any>> = {};

  await Promise.all(
    kinds.map(async (entity) => {
      const cached = getCachedPluginSchema(scope, entity);
      let schema = cached?.schema;

      if (!schema) {
        let schemaRes = await fetchSchema(entity, cached?.etag);
        if (schemaRes.notModified && !cached?.schema) {
          schemaRes = await fetchSchema(entity, undefined);
        }
        if (!schemaRes.notModified || !schema) {
          schema = schemaRes.schema;
          if (schema) {
            setCachedPluginSchema(scope, entity, {
              schema,
              etag: schemaRes.etag,
            });
          }
        }
      }

      let initialData: any | undefined;
      if (needInit && fetchInit) {
        initialData = await fetchInit(entity, initContext);
      }

      let options: any | undefined;
      if (fetchOptions && Object.keys(optionsContext).length > 0) {
        options = await getOrFetchPluginOptions(scope, entity, optionsContext, () =>
          fetchOptions(entity, optionsContext),
        );
      }

      dict[entity] = buildEditorConfig({ schema, initialData, options });
    }),
  );

  return dict;
}

export async function loadPluginEditorConfigForEntity(opts: {
  scope: PluginSchemaScope;
  entity: EntityKind;
  fetchSchema: SchemaFetcher;
  fetchInit?: InitFetcher;
  fetchOptions?: OptionsFetcher;
  needInit: boolean;
  initContext?: Record<string, any>;
  optionsContext?: Record<string, any>;
}): Promise<any> {
  const dict = await loadPluginEditorConfigs({
    ...opts,
    kinds: [opts.entity],
  });
  return dict[opts.entity] ?? null;
}
