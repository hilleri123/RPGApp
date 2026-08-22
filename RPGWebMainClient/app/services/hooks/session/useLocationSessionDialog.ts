'use client';

import { useLocationDialog } from '@/app/services/hooks/scenario/dialogs/useLocationDialog';
import { useSessionScenarioApi } from './useSessionScenarioApi';

import type { LocationOut, MapObjectPolygonCreate } from '@/app/services/types2';

type EditingLocation = Partial<LocationOut> & {
  map_objects?: MapObjectPolygonCreate[];
  data?: Record<string, any>;
};

export function useLocationSessionDialog(opts: {
  open: boolean;
  editingLocation?: EditingLocation | null;
  onSaved?: () => void;
}) {
  const { scenarioId, reloadSessionFields } = useSessionScenarioApi();

  return useLocationDialog({
    open: opts.open && !!scenarioId,
    scenarioId: String(scenarioId),
    locationId: opts.editingLocation?.id ? String(opts.editingLocation.id) : null,
    onSaved: async () => {
      reloadSessionFields(['locations']);
      opts.onSaved?.();
    },
  });
}
