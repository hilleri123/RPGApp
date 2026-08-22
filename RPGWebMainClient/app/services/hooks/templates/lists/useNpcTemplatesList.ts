'use client';

import { RuleTemplatesApiService } from '@/app/services/api/templates';
import { useTemplateObjectsList } from '../useTemplateObjectsList';
import type { NPCList } from '@/app/services/types2';

export function useNpcTemplatesList(
  templateSetId: string,
  opts?: { enabled?: boolean },
) {
  return useTemplateObjectsList<NPCList>({
    templateSetId,
    enabled: opts?.enabled,
    load: (api: any) => (api as RuleTemplatesApiService).getNpcTemplates(),
    sort: (xs) => [...xs].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
    remove: (api: any, id: string) => (api as RuleTemplatesApiService).deleteNpcTemplate(id),
  });
}
