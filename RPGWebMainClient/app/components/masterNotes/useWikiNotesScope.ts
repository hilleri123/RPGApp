'use client';

import { useMasterNotesScope } from '@/app/components/masterNotes/MasterNotesContext';
import { useScenarioMasterNotesScope } from '@/app/components/masterNotes/ScenarioMasterNotesProvider';

export function useWikiNotesScope() {
  const session = useMasterNotesScope();
  const scenario = useScenarioMasterNotesScope();
  return session ?? scenario;
}
