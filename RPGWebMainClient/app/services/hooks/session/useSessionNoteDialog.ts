'use client';

import { useNoteDialog } from '@/app/services/hooks/scenario/dialogs/useNoteDialog';
import { useSessionScenarioApi } from './useSessionScenarioApi';

export function useSessionNoteDialog(opts: {
  open: boolean;
  onSaved?: () => void;
}) {
  const { scenarioId, reloadSessionFields } = useSessionScenarioApi();

  return useNoteDialog({
    open: opts.open && !!scenarioId,
    scenarioId,
    noteId: null,
    onSaved: async () => {
      reloadSessionFields(['notes']);
      opts.onSaved?.();
    },
  });
}
