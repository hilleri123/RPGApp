'use client';

import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { useGameItemDialog } from '@/app/services/hooks/scenario/dialogs/useGameItemDialog';
import { useSessionScenarioApi } from './useSessionScenarioApi';

export function useGameItemSessionDialog(opts: {
  open: boolean;
  editingItem?: any | null;
  onSaved?: () => void;
}) {
  const { scenarioId, reloadSessionFields, moveToScene } = useSessionScenarioApi();
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const isCreate = !opts.editingItem?.id;

  return useGameItemDialog({
    open: opts.open && !!scenarioId,
    scenarioId,
    itemId: opts.editingItem?.id ? String(opts.editingItem.id) : null,
    onSaved: async (id) => {
      reloadSessionFields(['items', 'scenes']);
      if (isCreate && currentSceneId) {
        moveToScene(currentSceneId, undefined, id);
      }
      opts.onSaved?.();
    },
  });
}
