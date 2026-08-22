'use client';

import React from 'react';

import { ScenarioProvider } from '@/app/components/scenarios/ScenarioContext';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';

export function SessionScenarioDialogBridge({
  open,
  children,
}: React.PropsWithChildren<{ open: boolean }>) {
  const { scenarioId } = useSessionScenarioApi();

  if (!open || !scenarioId) return null;

  return <ScenarioProvider scenarioId={scenarioId}>{children}</ScenarioProvider>;
}
