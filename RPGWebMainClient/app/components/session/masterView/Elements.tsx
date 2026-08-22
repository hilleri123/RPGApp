'use client';

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Location, PlayerCharacter, NPC, GameItem } from "@/app/services/types2";
import { useState } from "react";
import ItemListTab from "./ItemListTab";
import LocationTab from "./LocationTab";
import NPCTab from "./NPCListTab";
import { TYPE_ICONS } from "@/lib/constants";

interface ElementsProps {
  location: Location | null;
  npcs: NPC[];
  items: GameItem[];
  characters: PlayerCharacter[];
  setEditingGameItem: (item: GameItem) => void;
}

export default function Elements({
  location,
  npcs,
  items,
  characters,
  setEditingGameItem,
}: ElementsProps) {
  const [activeElementTab, setActiveElementTab] = useState("locations");

  return (
    <div className="p-6 h-full min-h-0 flex flex-col">
      <h2 className="text-xl font-bold mb-4 shrink-0">Доступные элементы</h2>

      <Tabs
        value={activeElementTab}
        onValueChange={setActiveElementTab}
        className="w-full min-h-0 flex flex-col"
      >
        <TabsList className="w-full mb-6 shrink-0">
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <TYPE_ICONS.location className="w-4 h-4" />
            Локация {location?.name}
          </TabsTrigger>
          <TabsTrigger value="npc" className="flex items-center gap-2">
            <TYPE_ICONS.npc className="w-4 h-4" />
            NPC
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <TYPE_ICONS.item className="w-4 h-4" />
            Предметы
          </TabsTrigger>
        </TabsList>

        {/* TabsContent сами отвечают за скролл */}
        <div className="flex-1 min-h-0">
          <LocationTab location={location} />
          <NPCTab npcs={npcs} />
          <ItemListTab items={items} setEditingGameItem={setEditingGameItem} />
        </div>
      </Tabs>
    </div>
  );
}
