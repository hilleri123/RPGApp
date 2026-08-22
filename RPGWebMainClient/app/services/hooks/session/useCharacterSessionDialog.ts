'use client';

import { useCharacterDialog } from '@/app/services/hooks/scenario/dialogs/useCharacterDialog';
import { useSessionScenarioApi } from './useSessionScenarioApi';

export function useCharacterSessionDialog(opts: {
  open: boolean;
  editingCharacter?: any | null;
  onSaved?: () => void;
}) {
  const { scenarioId, reloadSessionFields } = useSessionScenarioApi();

  return useCharacterDialog({
    open: opts.open && !!scenarioId,
    scenarioId,
    characterId: opts.editingCharacter?.id ? String(opts.editingCharacter.id) : null,
    onSaved: async () => {
      reloadSessionFields(['characters']);
      opts.onSaved?.();
    },
  });
}
