'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { entityPacksApiService, type EntityPack } from '@/app/services/api/entityPacks';
import type { ScenarioWithCounts } from '@/app/services/types2';
import type { TemplatePackOption } from './TemplatePackFilter';

export function useScenarioLinkedPacks(scenario: ScenarioWithCounts | null) {
  const [rulePacks, setRulePacks] = useState<EntityPack[]>([]);

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    if (scenario?.template_set_id) ids.add(String(scenario.template_set_id));
    for (const id of scenario?.linked_template_set_ids ?? []) ids.add(String(id));
    return ids;
  }, [scenario?.template_set_id, scenario?.linked_template_set_ids]);

  const load = useCallback(async () => {
    if (!scenario?.rule_id_str) {
      setRulePacks([]);
      return;
    }
    const rows = await entityPacksApiService.listForRule(scenario.rule_id_str);
    setRulePacks(rows);
  }, [scenario?.rule_id_str]);

  useEffect(() => {
    void load();
  }, [load]);

  const packOptions: TemplatePackOption[] = useMemo(
    () =>
      rulePacks
        .filter((p) => linkedIds.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          isPrimary: String(scenario?.template_set_id) === p.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rulePacks, linkedIds, scenario?.template_set_id],
  );

  return { packOptions, reloadPacks: load };
}
