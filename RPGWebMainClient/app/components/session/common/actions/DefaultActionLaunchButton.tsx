'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

export type SceneAvailableActionLite = {
  key: string;
  title: string;
  description?: string | null;
  roles?: string[] | null;
};

export type ActionLaunchProps = {
  action: SceneAvailableActionLite;
  sceneId: string;
  onRun: (sceneId: string, actionKey: string) => void;
  compact?: boolean;
};

type Tone = {
  border: string;
  bg: string;
  bgHover: string;
  title: string;
  icon: string;
};

const DEFAULT_TONE: Tone = {
  border: 'border-white/15',
  bg: 'bg-zinc-900/80',
  bgHover: 'hover:bg-zinc-800/90 hover:border-white/25',
  title: 'text-zinc-100',
  icon: 'text-zinc-400',
};

export function ActionLaunchShell({
  action,
  sceneId,
  onRun,
  compact,
  icon,
  tone = DEFAULT_TONE,
  className,
}: ActionLaunchProps & {
  icon?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onRun(sceneId, action.key)}
      className={[
        'w-full rounded-lg border text-left transition-colors',
        tone.border,
        tone.bg,
        tone.bgHover,
        compact ? 'px-3 py-2.5' : 'px-3 py-2.5',
        className ?? '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 shrink-0 ${tone.icon}`}>
          {icon ?? <Sparkles className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium leading-snug ${tone.title}`}>
            {action.title}
          </div>
          {action.description ? (
            <div className="mt-0.5 text-xs text-zinc-400 line-clamp-2 leading-snug">
              {action.description}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function DefaultActionLaunchButton(props: ActionLaunchProps) {
  return <ActionLaunchShell {...props} />;
}
