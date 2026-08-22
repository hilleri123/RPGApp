'use client';

import { useEffect, useRef } from 'react';
import { getSceneBundle } from 'plugins/common/types/actionSelectors';
import { PerformMoveSetupStage as BasePerformMoveSetupStage } from '../../../../../../../base/ui/src/actions/perform_move/stages/PerformMoveSetupStage';

type Props = {
  user_id: string;
  action: any;
  value: any;
  patch: (next: Record<string, unknown>) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

function findPlayerCharacterId(action: any, userId: string): string | null {
  const { scene, links } = getSceneBundle(action);
  const map = links?.characterToUserId ?? {};
  for (const ch of scene?.characters ?? []) {
    const owner = map[ch.id];
    if (owner && String(owner) === String(userId)) {
      return String(ch.id);
    }
  }
  return null;
}

export function PerformMoveSetupStage(props: Props) {
  const { user_id, action, onSubmit } = props;
  const autoSubmittedRef = useRef(false);

  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id ?? '');
  const playerCharacterId = !isGm ? findPlayerCharacterId(action, user_id) : null;

  useEffect(() => {
    if (isGm || !playerCharacterId || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    onSubmit({
      actor_character_id: playerCharacterId,
      actor_npc_id: null,
      target_character_id: null,
      target_npc_id: null,
    });
  }, [isGm, onSubmit, playerCharacterId]);

  if (!isGm && playerCharacterId) {
    return (
      <div className="rounded border p-3 text-sm text-gray-300">
        Подставляем вашего персонажа и переходим к выбору хода…
      </div>
    );
  }

  return <BasePerformMoveSetupStage {...props} />;
}
