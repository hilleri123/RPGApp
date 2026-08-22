'use client';

/**
 * @deprecated Use SceneActionButtons / FreeDiceLaunchButton from
 * `@/app/components/session/common/actions` instead.
 */
export { FREE_DICE_ROLL_ACTION_KEY } from './actions/FreeDiceLaunchButton';
export { FREE_DICE_ROLL_ACTION_KEY as ACTION_KEY } from './actions/FreeDiceLaunchButton';

import FreeDiceLaunchButton from './actions/FreeDiceLaunchButton';

export function FreeDiceRollButton({
  sceneId,
  onRun,
  compact,
  className,
}: {
  sceneId: string | null | undefined;
  onRun: (sceneId: string, actionKey: string) => void;
  compact?: boolean;
  className?: string;
}) {
  if (!sceneId) return null;
  return (
    <div className={className}>
      <FreeDiceLaunchButton
        action={{ key: 'common.free_dice_roll', title: 'Свободный бросок' }}
        sceneId={sceneId}
        onRun={onRun}
        compact={compact}
      />
    </div>
  );
}
