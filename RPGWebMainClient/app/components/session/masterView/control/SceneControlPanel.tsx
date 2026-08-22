'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useParams } from 'next/navigation';
import { SessionSettings } from '@/app/services/types/session';
import { SessionSettingsDialog } from './SessionSettingsDialog';

export default function SceneControlPanel() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { settings, updateSettings, setDefaultSettings, session } = useSessionWebSocket(sessionId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="px-4 py-2 border-t border-gray-800 bg-gray-950 flex items-center justify-end shrink-0">
      <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
        <Settings className="w-4 h-4 mr-1.5" />
        Настройки
      </Button>

      <SessionSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        scenarioId={session?.scenario_id ?? null}
        sessionId={sessionId}
        onSave={async (next: SessionSettings) => {
          await updateSettings(next);
        }}
        onReset={async () => {
          await setDefaultSettings();
        }}
      />
    </div>
  );
}
