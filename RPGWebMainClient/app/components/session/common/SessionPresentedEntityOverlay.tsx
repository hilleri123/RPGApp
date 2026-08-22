'use client';

import { useMemo } from 'react';
import type { PresentedEntityView } from '@/app/services/types/presentation';
import type { Scene } from '@/app/services/types/session';
import type { Player } from '@/app/services/types/lobby';
import type { PluginUI } from '@/app/plugins/pluginTypes';
import {
  SessionEntityViewDialog,
  type SessionEntityViewKind,
} from './SessionEntityViewDialog';

type SessionPresentedEntityOverlayProps = {
  presentedEntity: PresentedEntityView | null | undefined;
  isMaster?: boolean;
  selfPlayer?: Player | null;
  scenes?: Scene[];
  onDismiss?: () => void;
  pluginUI?: PluginUI | null;
  scenarioId?: string | null;
};

function playerInPresentedScene(
  presentedEntity: PresentedEntityView,
  selfPlayer: Player | null | undefined,
  scenes: Scene[] | undefined,
): boolean {
  const charId = selfPlayer?.character_id;
  if (!charId) return false;
  const scene = scenes?.find((s) => String(s.id) === String(presentedEntity.scene_id));
  return Boolean(scene?.characters?.some((c) => String(c.id) === String(charId)));
}

export function SessionPresentedEntityOverlay({
  presentedEntity,
  isMaster = false,
  selfPlayer,
  scenes,
  onDismiss,
  pluginUI,
  scenarioId,
}: SessionPresentedEntityOverlayProps) {
  const visible = useMemo(() => {
    if (!presentedEntity) return false;
    if (isMaster) return true;
    return playerInPresentedScene(presentedEntity, selfPlayer, scenes);
  }, [presentedEntity, isMaster, selfPlayer, scenes]);

  if (!visible || !presentedEntity) return null;

  const kind = presentedEntity.entity_type as SessionEntityViewKind;

  return (
    <SessionEntityViewDialog
      open
      onClose={() => onDismiss?.()}
      canDismiss={isMaster}
      kind={kind}
      entity={presentedEntity.entity}
      dataAccess={presentedEntity.data_access}
      pluginUI={pluginUI}
      scenarioId={scenarioId}
      sceneId={String(presentedEntity.scene_id)}
    />
  );
}
