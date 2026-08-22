'use client';

import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GameItem } from "@/app/services/types2";
import { ItemDraggableSquare } from "@/app/components/common/squares/ItemDraggableSquare";

interface ItemListTabProps {
  items: GameItem[];
  setEditingGameItem: (item: GameItem) => void;
}

export default function ItemListTab({ items, setEditingGameItem }: ItemListTabProps) {
  return (
    <TabsContent value="items" className="h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
        <ScrollArea className="flex-1 min-h-0 pr-3">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            {items.length === 0 && (
              <h3 className="text-lg font-semibold mb-2">Нет предметов</h3>
            )}

            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <div key={item.id} className="group inline-block">
                  <ItemDraggableSquare
                    item={item}
                    isFullSize
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setEditingGameItem(item);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </TabsContent>
  );
}
