'use client';

import { MasterNotesPanel } from '@/app/components/masterNotes/MasterNotesPanel';
import { ScenarioMasterNotesProvider } from '@/app/components/masterNotes/ScenarioMasterNotesProvider';

export function ScenarioWikiTab() {
  return (
    <ScenarioMasterNotesProvider>
      <div className="min-h-[480px]">
        <MasterNotesPanel />
      </div>
    </ScenarioMasterNotesProvider>
  );
}
