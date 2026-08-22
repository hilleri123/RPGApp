'use client';

import { NoteEditDialog } from '@/app/components/scenarios/dialogs/NoteEditDialog';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function SessionNoteEditDialog({
  open,
  onClose,
  noteId,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  noteId: string | null;
  readOnly?: boolean;
}) {
  const { reloadSessionFields } = useSessionScenarioApi();

  return (
    <SessionScenarioDialogBridge open={open && !!noteId}>
      <NoteEditDialog
        open={open && !!noteId}
        onClose={onClose}
        editingId={noteId}
        readOnly={readOnly}
        onSave={() => reloadSessionFields(['notes'])}
      />
    </SessionScenarioDialogBridge>
  );
}
