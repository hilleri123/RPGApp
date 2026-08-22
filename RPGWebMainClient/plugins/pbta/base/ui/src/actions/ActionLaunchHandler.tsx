'use client';

import type { ActionLaunchProps } from '@/app/plugins/pluginTypes';
import { DefaultActionLaunchButton } from '@/app/components/session/common/actions';

/** Base PBTA: no custom launchers — fall through to default. */
export default function ActionLaunchHandler(props: ActionLaunchProps) {
  return <DefaultActionLaunchButton {...props} />;
}
