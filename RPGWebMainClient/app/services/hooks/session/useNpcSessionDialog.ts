'use client';

import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { useNpcDialog } from '@/app/services/hooks/scenario/dialogs/useNpcDialog';
import { useSessionScenarioApi } from './useSessionScenarioApi';

export function useNpcSessionDialog(opts: {
  open: boolean;
  editingNpc?: any | null;
  onSaved?: () => void;
}) {
  const { scenarioId, reloadSessionFields, moveToScene } = useSessionScenarioApi();
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const isCreate = !opts.editingNpc?.id;

  return useNpcDialog({
    open: opts.open && !!scenarioId,
    scenarioId,
    npcId: opts.editingNpc?.id ? String(opts.editingNpc.id) : null,
    onSaved: async (id) => {
      reloadSessionFields(['npcs', 'scenes']);
      if (isCreate && currentSceneId) {
        moveToScene(currentSceneId, id, undefined);
      }
      opts.onSaved?.();
    },
  });
}
