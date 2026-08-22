'use client';

import { ScenarioProvider } from '@/app/components/scenarios/ScenarioContext';
import ScenarioFrontsList from '@/app/components/scenarios/lists/FrontsList';

/** Fronts catalog inside session Content tab (scenario-scoped REST). */
export function SessionFrontsTab({ scenarioId }: { scenarioId: string }) {
  return (
    <ScenarioProvider scenarioId={scenarioId}>
      <div className="h-full min-h-0 overflow-auto pr-1">
        <ScenarioFrontsList />
      </div>
    </ScenarioProvider>
  );
}
