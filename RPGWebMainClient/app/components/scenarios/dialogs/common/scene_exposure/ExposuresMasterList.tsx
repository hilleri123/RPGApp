'use client';

import React, { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isTmpId, useSceneExposures } from './SceneExposuresContext';
import { TYPE_COLORS } from '@/lib/constants';

const SCENE_EXPOSURE_TAGS = [
  { code: 'use_once', label: 'Один раз', color: '#ff2d55' },
] as const;

type ExposureTagCode = (typeof SCENE_EXPOSURE_TAGS)[number]['code'];

function CountBadge(props: { label: string; count: number; color: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge style={{ backgroundColor: props.color }} className="text-[11px] px-2 py-0.5">
          {props.label}:{props.count}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">{props.label}: {props.count}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function TagToggle({
  code,
  label,
  color,
  active,
  disabled,
  onToggle,
}: {
  code: string;
  label: string;
  color: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          className={cn(
            'rounded border px-2 py-0.5 text-[11px] font-medium transition-colors',
            active
              ? 'border-transparent text-white'
              : 'border-gray-600 text-gray-400 bg-transparent hover:border-gray-400',
          )}
          style={active ? { backgroundColor: color, borderColor: color } : undefined}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">{active ? 'Убрать тег' : 'Добавить тег'}: {label}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ExposuresMasterList() {
  const { readOnly, exposures, selected, selectExposure, addExposure, removeSelected, patchSelected } =
    useSceneExposures();

  useEffect(() => {
    if (!selected) return;
    const exists = exposures.some((e) => String(e.id) === String(selected.id));
    if (!exists) selectExposure(null);
  }, [exposures, selected, selectExposure]);

  const toggleTag = (code: ExposureTagCode) => {
    if (!selected) return;
    const prev: string[] = selected.tags ?? [];
    const has = prev.includes(code);
    const next = has ? prev.filter((t) => t !== code) : [...prev, code];
    patchSelected({ tags: next });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={addExposure} disabled={readOnly}>
            Добавить
          </Button>
          <Button variant="destructive" onClick={removeSelected} disabled={readOnly || !selected}>
            Удалить
          </Button>
        </div>

        <div className="space-y-1">
          {exposures.map((e) => {
            const active = String(e.id) === String(selected?.id);

            const orderNum = e.order_num ?? 0;
            const templateNpcCount = (e.template_npc_links ?? []).reduce((sum, x) => sum + (x.qty ?? 1), 0);
            const templateItemCount = (e.template_item_links ?? []).reduce((sum, x) => sum + (x.qty ?? 1), 0);
            const npcCount = (e.npcs ?? []).length + templateNpcCount;
            const itemCount = (e.items ?? []).length + templateItemCount;
            const obstacleCount = (e.obstacles ?? []).length;

            const tags: string[] = e.tags ?? [];
            const isUseOnce = tags.includes('use_once');

            return (
              <div
                key={String(e.id)}
                className={cn(
                  'w-full rounded border p-2',
                  active ? 'border-blue-500 bg-gray-800' : 'border-gray-700',
                )}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => selectExposure(String(e.id))}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="shrink-0 inline-flex items-center justify-center rounded bg-gray-900 border border-gray-700 px-2 py-0.5 text-xs text-gray-200">
                            {orderNum}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">Порядок</div>
                        </TooltipContent>
                      </Tooltip>

                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">
                          {e.name || 'Без названия'}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isUseOnce && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: '#ff2d55' }}
                            >
                              1×
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">Показать один раз</div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <CountBadge label="NPC" count={npcCount} color={TYPE_COLORS.npc} />
                      <CountBadge label="Items" count={itemCount} color={TYPE_COLORS.item} />
                      <CountBadge label="Obs" count={obstacleCount} color={TYPE_COLORS.obstacle} />
                    </div>
                  </div>

                  {isTmpId(e.id) ? (
                    <div className="mt-1 text-[10px] text-gray-400">Не сохранено</div>
                  ) : null}
                </button>

                {active ? (
                  <div className="mt-2 space-y-2 border-t border-gray-700 pt-2">
                    <Input
                      placeholder="Название"
                      value={selected?.name ?? ''}
                      disabled={readOnly}
                      onChange={(ev) => patchSelected({ name: ev.target.value })}
                    />

                    <Input
                      placeholder="Порядок"
                      type="number"
                      value={selected?.order_num ?? 0}
                      disabled={readOnly}
                      onChange={(ev) => patchSelected({ order_num: Number(ev.target.value) })}
                    />

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {SCENE_EXPOSURE_TAGS.map((tag) => (
                        <TagToggle
                          key={tag.code}
                          code={tag.code}
                          label={tag.label}
                          color={tag.color}
                          active={(selected?.tags ?? []).includes(tag.code)}
                          disabled={readOnly}
                          onToggle={() => toggleTag(tag.code)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {exposures.length === 0 ? (
            <div className="text-gray-400 text-sm">Экспозиций пока нет.</div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}