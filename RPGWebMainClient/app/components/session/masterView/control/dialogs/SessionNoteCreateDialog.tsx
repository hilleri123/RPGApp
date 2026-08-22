'use client';

import { NoteEditDialog } from '@/app/components/scenarios/dialogs/NoteEditDialog';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function SessionNoteCreateDialog({
  open,
  onClose,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const { reloadSessionFields } = useSessionScenarioApi();

  return (
    <SessionScenarioDialogBridge open={open}>
      <NoteEditDialog
        open={open}
        onClose={onClose}
        editingId={null}
        readOnly={readOnly}
        onSave={() => reloadSessionFields(['notes'])}
      />
    </SessionScenarioDialogBridge>
  );
}
