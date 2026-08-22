import type { EntityKind } from './types2';

export type PluginSchemaScope =
  | { scope: 'scenario'; id: string }
  | { scope: 'template_set'; id: string }
  | { scope: 'rule'; id: string };

type CacheEntry = {
  schema: any;
  etag?: string;
};

/** In-memory cache only — resets on full page reload. */
const schemaCache = new Map<string, CacheEntry>();
const optionsCache = new Map<string, any>();
const optionsInflight = new Map<string, Promise<any>>();

function cacheKey(scope: PluginSchemaScope, entity: EntityKind): string {
  return `${scope.scope}:${scope.id}:${entity}`;
}

function stableJsonKey(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonKey).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonKey(obj[k])}`).join(',')}}`;
}

function optionsCacheKey(
  scope: PluginSchemaScope,
  entity: EntityKind,
  context: Record<string, any>,
): string {
  return `${cacheKey(scope, entity)}:opts:${stableJsonKey(context)}`;
}

export function getCachedPluginSchema(
  scope: PluginSchemaScope,
  entity: EntityKind,
): CacheEntry | undefined {
  return schemaCache.get(cacheKey(scope, entity));
}

export function setCachedPluginSchema(
  scope: PluginSchemaScope,
  entity: EntityKind,
  entry: CacheEntry,
): void {
  schemaCache.set(cacheKey(scope, entity), entry);
}

export function getCachedPluginOptions(
  scope: PluginSchemaScope,
  entity: EntityKind,
  context: Record<string, any>,
): any | undefined {
  return optionsCache.get(optionsCacheKey(scope, entity, context));
}

export function setCachedPluginOptions(
  scope: PluginSchemaScope,
  entity: EntityKind,
  context: Record<string, any>,
  options: any,
): void {
  optionsCache.set(optionsCacheKey(scope, entity, context), options);
}

export async function getOrFetchPluginOptions(
  scope: PluginSchemaScope,
  entity: EntityKind,
  context: Record<string, any>,
  fetcher: () => Promise<any>,
): Promise<any> {
  const cached = getCachedPluginOptions(scope, entity, context);
  if (cached !== undefined) return cached;

  const key = optionsCacheKey(scope, entity, context);
  const pending = optionsInflight.get(key);
  if (pending) return pending;

  const job = fetcher()
    .then((options) => {
      setCachedPluginOptions(scope, entity, context, options);
      return options;
    })
    .finally(() => {
      optionsInflight.delete(key);
    });

  optionsInflight.set(key, job);
  return job;
}

export function buildEditorConfig(parts: {
  schema: any;
  initialData?: any;
  options?: any;
}): any {
  const out: any = { ...parts.schema };
  if (parts.options && Object.keys(parts.options).length > 0) {
    out.options = parts.options;
  }
  if (parts.initialData !== undefined) {
    out.initialData = parts.initialData;
  }
  return out;
}
