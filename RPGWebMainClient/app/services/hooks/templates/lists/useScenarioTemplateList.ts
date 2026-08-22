'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import { entityPacksApiService } from '@/app/services/api/entityPacks';
import { RuleTemplatesApiService } from '@/app/services/api/templates';
import type { ScenarioTemplateListItem, TemplateEntityKind } from '@/app/services/types2/template_entity';

export function useScenarioTemplateList<T extends ScenarioTemplateListItem>(opts: {
  scenarioId: string;
  primaryPackId: string;
  entityKind: TemplateEntityKind;
  enabled?: boolean;
  load: (api: ScenarioScopedApiService) => Promise<T[]>;
  sort?: (items: T[]) => T[];
}) {
  const { scenarioId, primaryPackId, entityKind, enabled = true, load, sort } = opts;
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await load(api);
      const next = sort ? sort(res) : res;
      setItems(next);
      return next;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load list');
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, enabled, load, sort]);

  const didLoadRef = useRef<{ key: string | null; enabled: boolean }>({ key: null, enabled: false });

  useEffect(() => {
    const prev = didLoadRef.current;
    if (!enabled) {
      didLoadRef.current = { key: scenarioId, enabled: false };
      return;
    }
    const key = `${scenarioId}:${entityKind}`;
    const needLoad = prev.key !== key || prev.enabled === false;
    didLoadRef.current = { key, enabled: true };
    if (needLoad) void refetch();
  }, [scenarioId, entityKind, enabled, refetch]);

  const removeItem = useCallback(
    async (item: T) => {
      setError(null);
      try {
        if (item.can_unlink) {
          await entityPacksApiService.unlinkTemplateEntity(scenarioId, entityKind, String(item.id));
        } else if (item.can_delete) {
          const packId = item.template_pack_id ?? primaryPackId;
          const deleteApi = new RuleTemplatesApiService(packId);
          if (entityKind === 'npc') {
            await deleteApi.deleteNpcTemplate(String(item.id));
          } else if (entityKind === 'game_item') {
            await deleteApi.deleteItemTemplate(String(item.id));
          } else {
            await deleteApi.deleteCharacterTemplate(String(item.id));
          }
        } else {
          throw new Error(
            'Шаблон из подключённого пака. Отключите пак в настройках сценария.',
          );
        }
        await refetch();
        return { ok: true as const };
      } catch (e: any) {
        const message = e?.message ?? 'Failed to remove template';
        setError(message);
        return { ok: false as const, error: message };
      }
    },
    [entityKind, primaryPackId, refetch, scenarioId],
  );

  return { items, loading, error, refetch, removeItem };
}
