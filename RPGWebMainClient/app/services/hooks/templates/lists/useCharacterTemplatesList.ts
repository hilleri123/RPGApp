'use client';

import type { PlayerCharacterList } from '@/app/services/types2';
import { useTemplateObjectsList } from '../useTemplateObjectsList';
import { RuleTemplatesApiService } from '@/app/services/api/templates';

export function useCharacterTemplatesList(
  templateSetId: string,
  opts?: { enabled?: boolean },
) {
  return useTemplateObjectsList<PlayerCharacterList>({
    templateSetId,
    enabled: opts?.enabled ?? true,
    load: (api: any) => (api as RuleTemplatesApiService).getCharacterTemplates({ skip: 0, limit: 1000 }),
    remove: (api: any, id: string) => (api as RuleTemplatesApiService).deleteCharacterTemplate(id),
  });
}
