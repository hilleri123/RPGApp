'use client';

import { Dices } from 'lucide-react';
import {
  ActionLaunchShell,
  type ActionLaunchProps,
} from './DefaultActionLaunchButton';

export const FREE_DICE_ROLL_ACTION_KEY = 'common.free_dice_roll';

export default function FreeDiceLaunchButton(props: ActionLaunchProps) {
  return (
    <ActionLaunchShell
      {...props}
      icon={<Dices className="h-4 w-4" />}
      tone={{
        border: 'border-violet-500/40',
        bg: 'bg-violet-950/35',
        bgHover: 'hover:bg-violet-900/45 hover:border-violet-400/50',
        title: 'text-violet-100',
        icon: 'text-violet-300',
      }}
    />
  );
}
