'use client';

import { NpcEditDialog } from '@/app/components/scenarios/dialogs/NpcEditDialog';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function NpcSessionEditDialog({
  open,
  onClose,
  editingNpc,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  editingNpc?: { id?: string } | null;
  readOnly?: boolean;
}) {
  const { reloadSessionFields, moveToScene } = useSessionScenarioApi();
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const editingId = editingNpc?.id ? String(editingNpc.id) : null;
  const isCreate = !editingId;

  return (
    <SessionScenarioDialogBridge open={open}>
      <NpcEditDialog
        open={open}
        onClose={onClose}
        editingId={editingId}
        readOnly={readOnly}
        onSave={() => reloadSessionFields(['npcs', 'scenes'])}
        onEntitySaved={(id) => {
          if (isCreate && currentSceneId) {
            moveToScene(currentSceneId, id, undefined);
          }
        }}
      />
    </SessionScenarioDialogBridge>
  );
}
