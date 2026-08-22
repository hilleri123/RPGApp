'use client';

import type { ComponentType } from 'react';
import { ArrowUpCircle, BookOpen, Swords } from 'lucide-react';
import type { ActionLaunchProps } from '@/app/plugins/pluginTypes';
import {
  ActionLaunchShell,
  DefaultActionLaunchButton,
} from '@/app/components/session/common/actions';

function LevelUpLaunchButton(props: ActionLaunchProps) {
  return (
    <ActionLaunchShell
      {...props}
      icon={<ArrowUpCircle className="h-4 w-4" />}
      tone={{
        border: 'border-emerald-500/45',
        bg: 'bg-emerald-950/35',
        bgHover: 'hover:bg-emerald-900/45 hover:border-emerald-400/55',
        title: 'text-emerald-100',
        icon: 'text-emerald-300',
      }}
    />
  );
}

function PrepareSpellsLaunchButton(props: ActionLaunchProps) {
  return (
    <ActionLaunchShell
      {...props}
      icon={<BookOpen className="h-4 w-4" />}
      tone={{
        border: 'border-amber-500/40',
        bg: 'bg-amber-950/30',
        bgHover: 'hover:bg-amber-900/40 hover:border-amber-400/50',
        title: 'text-amber-100',
        icon: 'text-amber-300',
      }}
    />
  );
}

function PerformMoveLaunchButton(props: ActionLaunchProps) {
  return (
    <ActionLaunchShell
      {...props}
      icon={<Swords className="h-4 w-4" />}
      tone={{
        border: 'border-sky-500/40',
        bg: 'bg-sky-950/30',
        bgHover: 'hover:bg-sky-900/40 hover:border-sky-400/50',
        title: 'text-sky-100',
        icon: 'text-sky-300',
      }}
    />
  );
}

const LAUNCHERS: Record<string, ComponentType<ActionLaunchProps>> = {
  level_up: LevelUpLaunchButton,
  prepare_spells: PrepareSpellsLaunchButton,
  perform_move: PerformMoveLaunchButton,
};

export default function ActionLaunchHandler(props: ActionLaunchProps) {
  const Cmp = LAUNCHERS[props.action.key] ?? DefaultActionLaunchButton;
  return <Cmp {...props} />;
}
