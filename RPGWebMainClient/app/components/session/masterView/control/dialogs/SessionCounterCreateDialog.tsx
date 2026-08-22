'use client';

import { CounterEditDialog } from '@/app/components/scenarios/dialogs/CounterEditDialog';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function SessionCounterCreateDialog({
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
      <CounterEditDialog
        open={open}
        onClose={onClose}
        editingId={null}
        readOnly={readOnly}
        onSave={() => reloadSessionFields(['counters'])}
      />
    </SessionScenarioDialogBridge>
  );
}
