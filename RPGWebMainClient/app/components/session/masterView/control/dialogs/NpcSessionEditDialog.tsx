'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { NpcEditDialog } from '@/app/components/scenarios/dialogs/NpcEditDialog';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { Checkbox } from '@/components/ui/checkbox';
import { SessionScenarioDialogBridge } from './SessionScenarioDialogBridge';

export default function NpcSessionEditDialog({
  open,
  onClose,
  editingNpc,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  editingNpc?: { id?: string; tags?: string[] | null } | null;
  readOnly?: boolean;
}) {
  const params = useParams<{ id: string }>();
  const { reloadSessionFields, moveToScene } = useSessionScenarioApi();
  const { makeNPCDead } = useSessionWebSocket(params.id);
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const editingId = editingNpc?.id ? String(editingNpc.id) : null;
  const isCreate = !editingId;
  const tagKey = (editingNpc?.tags ?? []).join('\0');
  const [dead, setDead] = useState(() => (editingNpc?.tags ?? []).includes('dead'));

  useEffect(() => {
    setDead((editingNpc?.tags ?? []).includes('dead'));
  }, [editingId, tagKey]);

  return (
    <SessionScenarioDialogBridge open={open}>
      <NpcEditDialog
        open={open}
        onClose={onClose}
        editingId={editingId}
        readOnly={readOnly}
        leading={
          editingId && !readOnly ? (
            <label className="flex items-center gap-2 text-sm text-gray-200 mb-3">
              <Checkbox
                checked={dead}
                onCheckedChange={(value) => {
                  const next = Boolean(value);
                  setDead(next);
                  makeNPCDead(editingId, next);
                }}
              />
              Мёртвый
            </label>
          ) : null
        }
        onSave={() => reloadSessionFields(['npcs', 'scenes'])}
        onEntitySaved={(id) => {
          if (isCreate && currentSceneId) {
            moveToScene(currentSceneId, id, undefined);
          }
        }}
      />
    </SessionScenarioDialogBridge>
  );
}
