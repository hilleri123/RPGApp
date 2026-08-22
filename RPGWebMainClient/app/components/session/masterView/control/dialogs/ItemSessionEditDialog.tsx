'use client';

import { GameItemEditDialog } from '@/app/components/scenarios/dialogs/GameItemEditDialog';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function ItemSessionEditDialog({
  open,
  onClose,
  editingItem,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  editingItem?: { id?: string } | null;
  readOnly?: boolean;
}) {
  const { reloadSessionFields, moveToScene } = useSessionScenarioApi();
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const editingId = editingItem?.id ? String(editingItem.id) : null;
  const isCreate = !editingId;

  return (
    <SessionScenarioDialogBridge open={open}>
      <GameItemEditDialog
        open={open}
        onClose={onClose}
        editingId={editingId}
        readOnly={readOnly}
        onSave={() => reloadSessionFields(['items', 'scenes'])}
        onEntitySaved={(id) => {
          if (isCreate && currentSceneId) {
            moveToScene(currentSceneId, undefined, id);
          }
        }}
      />
    </SessionScenarioDialogBridge>
  );
}
