'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useScenario } from '../../ScenarioContext';
import { DualEntityLineageDialog } from './DualEntityLineageDialog';

type Props = {
  editingId: string | null;
  entityType: string;
  entityLabel?: string;
  readOnly?: boolean;
};

export function useLaunchedLineageExtras({
  editingId,
  entityType,
  entityLabel,
  readOnly,
}: Props) {
  const { scenarioId, scenario } = useScenario();
  const [lineageOpen, setLineageOpen] = useState(false);
  const isLaunched = Boolean(scenario?.is_session_snapshot && editingId && !readOnly);

  const footer = isLaunched
    ? {
        align: 'left' as const,
        render: () => (
          <Button type="button" variant="outline" size="sm" onClick={() => setLineageOpen(true)}>
            Редактировать с оригиналом
          </Button>
        ),
      }
    : undefined;

  const lineageDialog =
    isLaunched && editingId ? (
      <DualEntityLineageDialog
        open={lineageOpen}
        onClose={() => setLineageOpen(false)}
        scenarioId={scenarioId}
        entityType={entityType}
        entityId={editingId}
        entityLabel={entityLabel}
      />
    ) : null;

  return { footer, lineageDialog };
}
