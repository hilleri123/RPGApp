'use client';

import React from 'react';
import type { SceneExposurePreview } from '@/app/services/types2';
import { TYPE_COLORS } from '@/lib/constants';
import { NpcCompositionBadge } from '@/app/components/common/NpcCompositionBadge';

function CountChip({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className="px-1.5 py-0.5 rounded border text-[10px]"
      style={{
        color,
        borderColor: `${color}40`,
        background: `${color}15`,
      }}
    >
      {label}: {count}
    </span>
  );
}

function SceneExposurePreviewRow({ ex }: { ex: SceneExposurePreview }) {
  const hasNpc =
    ex.npc_normal > 0 || ex.npc_enemy > 0 || ex.npc_dead > 0 || ex.npc_enemy_dead > 0;
  const hasTemplateNpc =
    (ex.template_npc_normal ?? 0) > 0 ||
    (ex.template_npc_enemy ?? 0) > 0 ||
    (ex.template_npc_dead ?? 0) > 0 ||
    (ex.template_npc_enemy_dead ?? 0) > 0;

  const hasComposition =
    hasNpc ||
    hasTemplateNpc ||
    ex.item_count > 0 ||
    ex.template_item_qty > 0 ||
    ex.obstacle_count > 0 ||
    ex.audio_count > 0;

  return (
    <div className="rounded-md border border-gray-700/80 bg-gray-900/50 px-2 py-1.5 min-w-0 h-full">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[11px] font-medium text-gray-100 truncate">
          {ex.name || '(без названия)'}
        </span>
        <span className="text-[10px] text-gray-500 shrink-0">#{ex.order_num ?? 0}</span>
      </div>

      {hasComposition ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {hasNpc && (
            <NpcCompositionBadge
              composition={{
                normal: ex.npc_normal,
                enemy: ex.npc_enemy,
                dead: ex.npc_dead,
                enemyDead: ex.npc_enemy_dead,
              }}
            />
          )}
          {hasTemplateNpc && (
            <NpcCompositionBadge
              label="Шаб. NPC"
              composition={{
                normal: ex.template_npc_normal ?? 0,
                enemy: ex.template_npc_enemy ?? 0,
                dead: ex.template_npc_dead ?? 0,
                enemyDead: ex.template_npc_enemy_dead ?? 0,
              }}
            />
          )}
          <CountChip label="Предметы" count={ex.item_count} color={TYPE_COLORS.item} />
          <CountChip label="Шаб. предм." count={ex.template_item_qty} color={TYPE_COLORS.item} />
          <CountChip label="Препятствия" count={ex.obstacle_count} color={TYPE_COLORS.obstacle} />
          <CountChip label="Аудио" count={ex.audio_count} color="#94a3b8" />
        </div>
      ) : (
        <div className="mt-0.5 text-[10px] text-gray-500 italic">Пустая экспозиция</div>
      )}
    </div>
  );
}

export function SceneExposuresPreview({
  exposures,
}: {
  exposures?: SceneExposurePreview[] | null;
}) {
  const list = exposures ?? [];
  if (!list.length) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        Экспозиции · {list.length}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {list.map((ex) => (
          <SceneExposurePreviewRow key={ex.id} ex={ex} />
        ))}
      </div>
    </div>
  );
}
