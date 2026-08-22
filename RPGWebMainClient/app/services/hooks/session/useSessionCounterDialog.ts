'use client';

import { useCounterDialog } from '@/app/services/hooks/scenario/dialogs/useCounterDialog';
import { useSessionScenarioApi } from './useSessionScenarioApi';

export function useSessionCounterDialog(opts: {
  open: boolean;
  onSaved?: () => void;
}) {
  const { scenarioId, reloadSessionFields } = useSessionScenarioApi();

  return useCounterDialog({
    open: opts.open && !!scenarioId,
    scenarioId,
    counterId: null,
    onSaved: async () => {
      reloadSessionFields(['counters']);
      opts.onSaved?.();
    },
  });
}
