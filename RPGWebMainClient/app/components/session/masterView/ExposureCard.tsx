'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExposureDetailDialog } from './ExposureDetailDialog';
import type { NPC, SceneExposure, SceneExposureOut } from '@/app/services/types2';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useParams } from 'next/navigation';
import { TYPE_COLORS } from "@/lib/constants";
import { NpcCompositionBadge } from '@/app/components/common/NpcCompositionBadge';

export function ExposureCard({
  ex,
  scene_id,
  location_id,
  story_beat_id,
  applySceneExposure,
}: {
  ex: SceneExposureOut;
  scene_id: string;
  location_id?: string;
  story_beat_id?: string;
  applySceneExposure: (sceneId: string, expositionId: string, from_location_id?: string, from_story_beat?: string) => void;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [open, setOpen] = useState(false);
  const { npcs: sessionNpcs, items: sessionItems, factories } = useSessionWebSocket(sessionId) as any;

  const resolvedNpcs         = ex.npcs ?? [];
  const resolvedItems        = ex.items ?? [];

  // template_npc_links → плоский список NPC для отображения
  const resolvedTemplateNpcs = useMemo(
    () => (ex.template_npc_links ?? []).map((l) => l.template_npc),
    [ex.template_npc_links],
  );

  // template_item_links → плоский список items для отображения
  const resolvedTemplateItems = useMemo(
    () => (ex.template_item_links ?? []).map((l) => l.template_item),
    [ex.template_item_links],
  );

  // суммарное кол-во шаблонных NPC с учётом qty
  const templateNpcTotal = useMemo(
    () => (ex.template_npc_links ?? []).reduce((s, l) => s + (l.qty ?? 1), 0),
    [ex.template_npc_links],
  );

  const templateItemTotal = useMemo(
    () => (ex.template_item_links ?? []).reduce((s, l) => s + (l.qty ?? 1), 0),
    [ex.template_item_links],
  );

  const obstacles = ex.obstacles ?? [];

  const exOut: SceneExposureOut = {
    id: ex.id!,
    name: ex.name,
    order_num: ex.order_num,
    tags: ex.tags,
    npcs: resolvedNpcs,
    items: resolvedItems,
    template_npc_links: ex.template_npc_links ?? [],
    template_item_links: ex.template_item_links ?? [],
    obstacles: obstacles as any,
    audio_tracks: [],
  };

  return (
    <>
      <div
        className="rounded border border-gray-700 bg-gray-900/70 px-3 py-2 text-xs text-gray-100 flex flex-col gap-1 min-w-[200px] cursor-pointer hover:border-gray-500 transition-colors"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium truncate">{ex.name || '(без названия)'}</div>
          <span className="text-[10px] text-gray-500">#{ex.order_num ?? 0}</span>
        </div>

        <div className="flex flex-wrap gap-1 text-[10px]">
          {resolvedNpcs.length > 0 && (
            <NpcCompositionBadge npcs={resolvedNpcs} />
          )}
          {resolvedTemplateNpcs.length > 0 && (
            <NpcCompositionBadge npcs={resolvedTemplateNpcs} label="Шаб. NPC" />
          )}
          {resolvedItems.length > 0 && (
            <span className="px-1 py-0.5 rounded border" style={{
              color: TYPE_COLORS.item,
              borderColor: `${TYPE_COLORS.item}40`,
              background: `${TYPE_COLORS.item}15`,
            }}>
              Предметы: {resolvedItems.length}
            </span>
          )}
          {templateItemTotal > 0 && (
            <span className="px-1 py-0.5 rounded border" style={{
              color: TYPE_COLORS.item,
              borderColor: `${TYPE_COLORS.item}40`,
              background: `${TYPE_COLORS.item}15`,
            }}>
              Шаб. предметы: {templateItemTotal}
            </span>
          )}
          {obstacles.length > 0 && (
            <span className="px-1 py-0.5 rounded border" style={{
              color: TYPE_COLORS.obstacle,
              borderColor: `${TYPE_COLORS.obstacle}40`,
              background: `${TYPE_COLORS.obstacle}15`,
            }}>
              Препятствия: {obstacles.length}
            </span>
          )}
        </div>

        <div className="mt-1 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] px-2 py-1 h-6"
            onClick={() => applySceneExposure(scene_id, ex.id!, location_id, story_beat_id)}
          >
            Применить к сцене
          </Button>
        </div>
      </div>

      {open && (
        <ExposureDetailDialog
          open={open}
          onClose={() => setOpen(false)}
          ex={exOut}
          scene_id={scene_id}
          location_id={location_id}
          story_beat_id={story_beat_id}
          applySceneExposure={applySceneExposure}
        />
      )}
    </>
  );
}