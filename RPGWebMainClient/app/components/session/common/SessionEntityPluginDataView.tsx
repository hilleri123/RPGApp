'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EntityKind } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import { loadPluginEditorConfigForEntity } from '@/app/services/loadPluginEditorConfigs';
import type { PluginUI } from '@/app/plugins/pluginTypes';
import type { SessionEntityViewKind } from './SessionEntityViewDialog';

const KIND_TO_ENTITY: Partial<Record<SessionEntityViewKind, EntityKind>> = {
  npc: 'npc',
  game_item: 'item',
  player_character: 'character',
};

type SessionEntityPluginDataViewProps = {
  kind: SessionEntityViewKind;
  data: Record<string, unknown>;
  pluginUI?: PluginUI | null;
  scenarioId?: string | null;
  sceneId?: string | null;
};

export function SessionEntityPluginDataView({
  kind,
  data,
  pluginUI,
  scenarioId,
  sceneId,
}: SessionEntityPluginDataViewProps) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityKind = KIND_TO_ENTITY[kind];
  const needsConfig = kind === 'player_character';

  const View = useMemo(() => {
    if (kind === 'npc') return pluginUI?.NPCDataView;
    if (kind === 'game_item') return pluginUI?.ItemDataView;
    if (kind === 'player_character') return pluginUI?.CharacterDataView;
    return null;
  }, [kind, pluginUI]);

  const api = useMemo(
    () => (scenarioId ? new ScenarioScopedApiService(scenarioId) : null),
    [scenarioId],
  );

  useEffect(() => {
    if (!needsConfig || !api || !entityKind) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cfg = await loadPluginEditorConfigForEntity({
          scope: { scope: 'scenario', id: scenarioId! },
          entity: entityKind,
          needInit: false,
          optionsContext: {
            playbook_id: (data as any)?.playbook_id ?? null,
            level: (data as any)?.level ?? null,
            scene_id: sceneId ?? null,
          },
          fetchSchema: (entity, etag) => api.getEntitySchema(entity, etag),
          fetchOptions: (entity, ctx) => api.getEntityOptions(entity, ctx),
        });
        if (!cancelled) setConfig(cfg ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsConfig, api, entityKind, scenarioId, data, sceneId]);

  if (!View) {
    return (
      <p className="text-xs text-gray-500 italic">
        Просмотр правил для этого типа сущности не подключён в плагине.
      </p>
    );
  }

  if (needsConfig && loading) {
    return <p className="text-xs text-gray-500">Загрузка данных правил…</p>;
  }

  if (needsConfig && error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  if (needsConfig && !config) {
    return <p className="text-xs text-gray-500 italic">Конфиг правил недоступен.</p>;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Игровые данные</h3>
      <View data={data} config={config ?? undefined} />
    </section>
  );
}
