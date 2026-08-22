'use client';

import { CharacterEditDialog } from '@/app/components/scenarios/dialogs/CharacterEditDialog';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function CharacterSessionEditDialog({
  open,
  onClose,
  editingCharacter,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  editingCharacter?: { id?: string } | null;
  readOnly?: boolean;
}) {
  const { reloadSessionFields } = useSessionScenarioApi();
  const editingId = editingCharacter?.id ? String(editingCharacter.id) : null;

  return (
    <SessionScenarioDialogBridge open={open}>
      <CharacterEditDialog
        open={open}
        onClose={onClose}
        editingId={editingId}
        readOnly={readOnly}
        onSave={() => reloadSessionFields(['characters'])}
      />
    </SessionScenarioDialogBridge>
  );
}
