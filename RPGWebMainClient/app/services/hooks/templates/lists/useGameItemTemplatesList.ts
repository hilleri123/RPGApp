'use client';

import { RuleTemplatesApiService } from '@/app/services/api/templates';
import { useTemplateObjectsList } from '../useTemplateObjectsList';
import type { GameItemWithOwnerShort } from '@/app/services/types2';

export function useGameItemTemplatesList(
  templateSetId: string,
  opts?: { enabled?: boolean },
) {
  return useTemplateObjectsList<GameItemWithOwnerShort>({
    templateSetId,
    enabled: opts?.enabled,
    load: (api: any) => (api as RuleTemplatesApiService).getItemTemplates(),
    sort: (xs) => [...xs].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
    remove: (api: any, id: string) => (api as RuleTemplatesApiService).deleteItemTemplate(id),
  });
}
