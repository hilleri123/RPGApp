'use client';

import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GameItem, Location } from "@/app/services/types2";
import { ObstacleDraggableSquare } from "../../common/squares/ObstacleDraggableSquare";
import { ItemDraggableSquare } from "../../common/squares/ItemDraggableSquare";
import { NPCDraggableSquare } from "../../common/squares/NPCDraggableSquare";

interface LocationTabProps {
  location: Location | null;
}

export default function LocationTab({ location }: LocationTabProps) {
  return (
    <TabsContent value="locations" className="h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0 pr-3">
        {!location ? null : (
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold mb-2">{location.name}</h3>

            <div className="text-gray-400 text-sm mb-4">
              <div dangerouslySetInnerHTML={{ __html: location.description_for_players }} />
            </div>

            <div className="text-gray-400 text-sm mb-4">
              Мастеру:
              <div dangerouslySetInnerHTML={{ __html: location.description_for_master }} />
            </div>

            <h4 className="font-medium mb-3">Доступные элементы в локации:</h4>
          </div>
        )}
      </ScrollArea>
          </div>
    </TabsContent>
  );
}
