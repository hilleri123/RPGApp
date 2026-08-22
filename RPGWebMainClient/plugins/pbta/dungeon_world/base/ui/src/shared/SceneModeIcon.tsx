'use client';

import { Footprints, Swords, Tent, type LucideIcon } from 'lucide-react';
import { MODE_ICON_CLASS, type SceneMode } from './sceneModes';
import { cn } from '@/lib/utils';

const MODE_ICON: Record<SceneMode, LucideIcon> = {
  travel: Footprints,
  camp: Tent,
  action: Swords,
};

type Props = {
  mode: SceneMode;
  className?: string;
  colored?: boolean;
};

export function SceneModeIcon({ mode, className, colored = true }: Props) {
  const Icon = MODE_ICON[mode];
  return (
    <Icon
      className={cn('w-[18px] h-[18px] shrink-0', colored && MODE_ICON_CLASS[mode], className)}
      aria-hidden
    />
  );
}
