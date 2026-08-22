'use client';

import { LocationEditDialog } from '@/app/components/scenarios/dialogs/LocationEditDialog';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function LocationSessionEditDialog({
  open,
  onClose,
  editingLocation,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  editingLocation?: { id?: string } | null;
  readOnly?: boolean;
}) {
  const { reloadSessionFields } = useSessionScenarioApi();
  const editingId = editingLocation?.id ? String(editingLocation.id) : null;

  return (
    <SessionScenarioDialogBridge open={open}>
      <LocationEditDialog
        open={open}
        onClose={onClose}
        editingId={editingId}
        readOnly={readOnly}
        onSave={() => reloadSessionFields(['locations', 'scenes'])}
      />
    </SessionScenarioDialogBridge>
  );
}
