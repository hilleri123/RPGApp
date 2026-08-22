// components/master/StoryBeatApplyDialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { StoryBeatOut } from "@/app/services/types2";
import { ExposureCard } from "../ExposureCard";


// ---------------- StoryBeatApplyDialog ----------------

interface StoryBeatApplyDialogProps {
  open: boolean;
  onClose: () => void;
  storyBeat: StoryBeatOut | null;
  sceneId: string | null;
  applySceneExposure: (
    sceneId: string,
    expositionId: string,
    from_location_id?: string,
    from_story_beat?: string,
  ) => void;
}

export function StoryBeatApplyDialog({
  open,
  onClose,
  storyBeat,
  sceneId,
  applySceneExposure,
}: StoryBeatApplyDialogProps) {
  const [selectedExposureId, setSelectedExposureId] = useState<string | null>(null);

  if (!storyBeat || !sceneId) return null;

  const canApply = !!sceneId && !!selectedExposureId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Стори‑бит: {storyBeat.name}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4 text-sm text-gray-100">
            {storyBeat.text_for_master && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Текст для мастера</div>
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: storyBeat.text_for_master }}
                />
              </div>
            )}

            {storyBeat.text_for_players && (
              <div>
                <div className="text-xs text-gray-400 mb-1">
                  Текст для игроков
                </div>
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{
                    __html: storyBeat.text_for_players,
                  }}
                />
              </div>
            )}

            <div>
              <div className="text-xs text-gray-400 mb-2">
                Экспозиции сцены
              </div>
              <div className="flex flex-col gap-1">
                {storyBeat.scene_exposures.map((ex: any) => (
                  <ExposureCard
                    key={ex.id}
                    ex={ex}
                    scene_id={sceneId}
                    story_beat_id={storyBeat.id}
                    applySceneExposure={applySceneExposure}
                  />
                ))}
                {storyBeat.scene_exposures.length === 0 && (
                  <div className="text-xs text-gray-500 italic">
                    Для этого стори‑бита пока нет экспозиций
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
