'use client';

import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type { ExpandDir } from './mapCanvasUtils';
import { MAP_EXPAND_STEP } from './mapCanvasUtils';

interface CanvasSizeBarProps {
  width: number;
  height: number;
  readOnly?: boolean;
  expanding?: boolean;
  onExpand: (dir: ExpandDir) => void;
}

export function CanvasSizeBar({
  width,
  height,
  readOnly = false,
  expanding = false,
  onExpand,
}: CanvasSizeBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">
        Холст: {width} × {height}px
      </span>
      <span className="opacity-70">расширить на {MAP_EXPAND_STEP}px</span>
      <div className="flex items-center gap-1">
        {(
          [
            ['n', ArrowUp, 'Вверх'],
            ['w', ArrowLeft, 'Влево'],
            ['e', ArrowRight, 'Вправо'],
            ['s', ArrowDown, 'Вниз'],
          ] as const
        ).map(([dir, Icon, label]) => (
          <Button
            key={dir}
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || expanding}
            title={`Расширить ${label.toLowerCase()} на ${MAP_EXPAND_STEP}px`}
            onClick={() => onExpand(dir)}
            className="h-7 w-7 p-0"
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
    </div>
  );
}
