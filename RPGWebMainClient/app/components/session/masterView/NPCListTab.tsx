'use client';

import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NPCDraggableSquare } from "../../common/squares/NPCDraggableSquare";
import { NPC } from "@/app/services/types2";

interface NPCTabProps {
  npcs: NPC[];
}

export default function NPCTab({ npcs }: NPCTabProps) {
  return (
    <TabsContent value="npc" className="h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
        <ScrollArea className="flex-1 min-h-0 pr-3">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            {npcs.length === 0 && (
              <h3 className="text-lg font-semibold mb-2">Нет NPC</h3>
            )}

            <div className="grid grid-cols-1 gap-3">
              {npcs.map((npc) => (
                <div key={npc.id} className="group inline-block">
                  <NPCDraggableSquare npc={npc} isFullSize />
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </TabsContent>
  );
}
