'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  NPCDraggableSquare,
} from '@/app/components/common/squares/NPCDraggableSquare';
import {
  ItemDraggableSquare,
} from '@/app/components/common/squares/ItemDraggableSquare';
import {
  ObstacleDraggableSquare,
} from '@/app/components/common/squares/ObstacleDraggableSquare';
import { GameItem, NPC, SceneExposureOut } from '@/app/services/types2';
import { TYPE_COLORS } from "@/lib/constants";

function Section({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div
        className="text-[11px] uppercase tracking-wide font-semibold"
        style={{ color }}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

function QtyBadge({ qty }: { qty: number }) {
  if (qty <= 1) return null;

  return (
    <div className="mt-1 text-center">
      <span className="inline-flex items-center rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-200">
        x{qty}
      </span>
    </div>
  );
}

export function ExposureDetailDialog({
  open,
  onClose,
  ex,
  scene_id,
  location_id,
  story_beat_id,
  applySceneExposure,
}: {
  open: boolean;
  onClose: () => void;
  ex: SceneExposureOut;
  scene_id: string;
  location_id?: string;
  story_beat_id?: string;
  applySceneExposure: (sceneId: string, expositionId: string, from_location_id?: string, from_story_beat?: string) => void;
}) {
  const npcs = ex.npcs ?? [];
  const items = ex.items ?? [];
  const templateNpcLinks = ex.template_npc_links ?? [];
  const templateItemLinks = ex.template_item_links ?? [];
  const obstacles = ex.obstacles ?? [];

  const isEmpty =
    !npcs.length &&
    !items.length &&
    !templateNpcLinks.length &&
    !templateItemLinks.length &&
    !obstacles.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ex.name || '(без названия)'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          {isEmpty ? (
            <div className="text-xs text-gray-500 py-4 text-center">
              Экспозиция пустая
            </div>
          ) : (
            <div className="space-y-4 py-1">
              {npcs.length > 0 && (
                <Section label="NPC" color={TYPE_COLORS.npc}>
                  {npcs.map((npc) => (
                    <NPCDraggableSquare
                      key={npc.id}
                      npc={{ ...npc, data: {} } as NPC}
                      isMaster={false}
                      contextItems={[]}
                    />
                  ))}
                </Section>
              )}

              {templateNpcLinks.length > 0 && (
                <Section label="Шаблонные NPC" color={TYPE_COLORS.npc}>
                  {templateNpcLinks.map((link, idx) => (
                    <div key={`${link.template_npc.id}_${idx}`} className="flex flex-col items-center">
                      <NPCDraggableSquare
                        npc={{ ...link.template_npc, data: {} } as NPC}
                        isMaster={false}
                        contextItems={[]}
                      />
                      <QtyBadge qty={link.qty ?? 1} />
                    </div>
                  ))}
                </Section>
              )}

              {items.length > 0 && (
                <Section label="Предметы" color={TYPE_COLORS.item}>
                  {items.map((item) => (
                    <ItemDraggableSquare
                      key={item.id}
                      item={{ ...item, data: {} } as GameItem}
                      isMaster={false}
                      contextItems={[]}
                    />
                  ))}
                </Section>
              )}

              {templateItemLinks.length > 0 && (
                <Section label="Шаблонные предметы" color={TYPE_COLORS.item}>
                  {templateItemLinks.map((link, idx) => (
                    <div key={`${link.template_item.id}_${idx}`} className="flex flex-col items-center">
                      <ItemDraggableSquare
                        item={{ ...link.template_item, data: {} } as GameItem}
                        isMaster={false}
                        contextItems={[]}
                      />
                      <QtyBadge qty={link.qty ?? 1} />
                    </div>
                  ))}
                </Section>
              )}

              {obstacles.length > 0 && (
                <Section label="Препятствия" color={TYPE_COLORS.obstacle}>
                  {obstacles.map((obstacle) => (
                    <ObstacleDraggableSquare
                      key={obstacle.id}
                      obstacle={obstacle}
                      isMaster={false}
                      contextItems={[]}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between items-center pt-2 border-t border-gray-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            size="sm"
            onClick={() => {
              applySceneExposure(scene_id, ex.id, location_id, story_beat_id);
              onClose();
            }}
          >
            Применить к сцене
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}