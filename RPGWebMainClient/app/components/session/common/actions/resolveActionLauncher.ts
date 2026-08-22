'use client';

import type { ComponentType } from 'react';
import DefaultActionLaunchButton, {
  type ActionLaunchProps,
} from './DefaultActionLaunchButton';
import FreeDiceLaunchButton, { FREE_DICE_ROLL_ACTION_KEY } from './FreeDiceLaunchButton';

export const COMMON_LAUNCHERS: Record<string, ComponentType<ActionLaunchProps>> = {
  [FREE_DICE_ROLL_ACTION_KEY]: FreeDiceLaunchButton,
};

export function resolveActionLauncher(
  actionKey: string,
  PluginLaunchHandler?: ComponentType<ActionLaunchProps> | null,
): ComponentType<ActionLaunchProps> {
  const common = COMMON_LAUNCHERS[actionKey];
  if (common) return common;
  if (PluginLaunchHandler) return PluginLaunchHandler;
  return DefaultActionLaunchButton;
}
