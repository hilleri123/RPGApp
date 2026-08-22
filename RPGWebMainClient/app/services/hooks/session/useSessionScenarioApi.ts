'use client';

import { useCallback, useContext, useMemo } from 'react';
import { useParams } from 'next/navigation';

import { useSessionsStore } from '@/app/services/stores/sessions';
import { SessionSocketContext } from '@/app/services/providers/SessionWebSocketProvider';
import { useMasterNotesScope } from '@/app/components/masterNotes/MasterNotesContext';
import { useScenarioMasterNotesScope } from '@/app/components/masterNotes/ScenarioMasterNotesProvider';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import { MASTER_ROLE, SessionActionBase } from '@/app/services/types/session';

export function useSessionScenarioApi() {
  const params = useParams<{ id: string }>();
  const sessionCtx = useContext(SessionSocketContext);
  const sessionId = sessionCtx ? params.id : '';

  const scenarioIdFromSession = useSessionsStore(
    (s) => (sessionId ? s.sessions[sessionId]?.session?.scenario_id ?? '' : ''),
  );
  const masterNotesScope = useMasterNotesScope();
  const scenarioMasterNotesScope = useScenarioMasterNotesScope();

  const scenarioId = String(
    scenarioIdFromSession ||
      masterNotesScope?.scenarioId ||
      scenarioMasterNotesScope?.scenarioId ||
      '',
  );

  const reloadSessionFields = useCallback(
    (fields: string[]) => {
      if (!sessionCtx) return;
      sessionCtx.sendAction({
        user_role: MASTER_ROLE,
        msg_type: 'reload_entities',
        fields,
      } as SessionActionBase);
    },
    [sessionCtx],
  );

  const moveToScene = useCallback(
    (sceneId: string, npcId?: string, itemId?: string) => {
      if (!sessionCtx) return;
      sessionCtx.sendAction({
        user_role: MASTER_ROLE,
        msg_type: 'move_to_scene',
        scene_id: sceneId,
        ...(npcId !== undefined && { npc_id: npcId }),
        ...(itemId !== undefined && { item_id: itemId }),
      });
    },
    [sessionCtx],
  );

  const api = useMemo(
    () => (scenarioId ? new ScenarioScopedApiService(scenarioId) : null),
    [scenarioId],
  );

  return {
    sessionId,
    scenarioId,
    api,
    reloadSessionFields,
    moveToScene,
    inSession: Boolean(sessionCtx),
  };
}
