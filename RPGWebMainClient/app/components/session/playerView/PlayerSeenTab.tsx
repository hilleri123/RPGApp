'use client';

import { useState } from "react";
import { Location, NPC, GameItem } from "@/app/services/types2";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TYPE_ICONS } from "@/lib/constants";
import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";
import MapSection from "../common/MapSection";
import { SeenEntityListItem } from "../common/SeenEntityListItem";
import {
  SessionEntityViewDialog,
  type SessionEntityViewKind,
} from "../common/SessionEntityViewDialog";
import { resolveSeenDataAccess } from "@/app/services/types/playerSeen";

interface PlayerSeenTabProps {
  sessionId: string;
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;
}

type ViewState =
  | { kind: SessionEntityViewKind; entity: NPC | GameItem | Location }
  | null;

export default function PlayerSeenTab({
  sessionId,
  currentLocation,
  setCurrentLocation,
}: PlayerSeenTabProps) {
  const {
    locations, npcs, items, characters, scenes, polygon_shown, session, playerSeen,
  } = usePlayerSessionWebSocket(sessionId);

  const [activeElementTab, setActiveElementTab] = useState("locations");
  const [viewState, setViewState] = useState<ViewState>(null);

  const openView = (kind: SessionEntityViewKind, entity: NPC | GameItem | Location) => {
    setViewState({ kind, entity });
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <Tabs
        value={activeElementTab}
        onValueChange={setActiveElementTab}
        className="flex flex-col min-h-0 h-full"
      >
        <TabsList className="shrink-0 grid grid-cols-3 w-full mb-2 h-auto">
          <TabsTrigger value="locations" className="flex items-center gap-1 text-xs px-2 py-2">
            <TYPE_ICONS.location className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Локации</span>
          </TabsTrigger>
          <TabsTrigger value="npc" className="flex items-center gap-1 text-xs px-2 py-2">
            <TYPE_ICONS.npc className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">NPC</span>
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-1 text-xs px-2 py-2">
            <TYPE_ICONS.item className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Вещи</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-0 space-y-2">
          {locations.length === 0 ? (
            <p className="text-xs text-gray-500 px-1">Пока нет открытых локаций</p>
          ) : (
            locations.map((loc) => (
              <SeenEntityListItem
                key={loc.id}
                kind="location"
                name={loc.name}
                subtitle={loc.description_for_players}
                iconUrl={loc.icon_url}
                onClick={() => openView('location', loc)}
              />
            ))
          )}

          {currentLocation && (
            <div className="pt-2 border-t border-gray-800">
              <MapSection
                currentLocation={currentLocation}
                enabledPolygonIds={polygon_shown}
                locationList={locations}
                scenes={scenes}
                session={session}
                characters={characters}
                editable={false}
                setCurrentLocation={setCurrentLocation}
                className="w-full"
                isMaster={false}
                compact
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="npc" className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-0 space-y-2">
          {npcs.length === 0 ? (
            <p className="text-xs text-gray-500 px-1">Нет открытых NPC</p>
          ) : (
            npcs.map((npc) => (
              <SeenEntityListItem
                key={npc.id}
                kind="npc"
                name={npc.name}
                subtitle={npc.description_for_players}
                iconUrl={npc.icon_url}
                imgUrl={npc.img_url}
                onClick={() => openView('npc', npc)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="items" className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-0 space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-gray-500 px-1">Нет открытых предметов</p>
          ) : (
            items.map((item) => (
              <SeenEntityListItem
                key={item.id}
                kind="game_item"
                name={item.name}
                subtitle={item.description_for_players}
                iconUrl={item.icon_url}
                imgUrl={item.img_url}
                onClick={() => openView('game_item', item)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {viewState ? (
        <SessionEntityViewDialog
          open
          onClose={() => setViewState(null)}
          kind={viewState.kind}
          entity={viewState.entity}
          dataAccess={
            viewState.kind === 'location'
              ? resolveSeenDataAccess(playerSeen, 'location', { id: viewState.entity.id })
              : resolveSeenDataAccess(
                  playerSeen,
                  viewState.kind,
                  viewState.entity as NPC | GameItem,
                )
          }
        />
      ) : null}
    </div>
  );
}
