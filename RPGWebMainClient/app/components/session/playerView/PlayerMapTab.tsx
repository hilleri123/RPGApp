'use client';

import { useEffect, useMemo, useState } from "react";
import { Location } from "@/app/services/types2";
import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";
import MapSection from "../common/MapSection";

interface PlayerMapTabProps {
  sessionId: string;
}

export default function PlayerMapTab({ sessionId }: PlayerMapTabProps) {
  const { scene, characters, locations, scenes, polygon_shown, session } = usePlayerSessionWebSocket(sessionId);

  const homeLocation: Location | null = scene?.location ?? null;
  const [currentLocation, setCurrentLocation] = useState<Location | null>(homeLocation);

  useEffect(() => {
    setCurrentLocation(homeLocation);
  }, [homeLocation?.id]);

  if (!scene || !homeLocation) {
    return (
      <div className="text-xs text-gray-400 p-2">
        Карта недоступна — персонаж не на сцене.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <MapSection
        currentLocation={currentLocation}
        enabledPolygonIds={polygon_shown}
        setCurrentLocation={setCurrentLocation}
        scenes={scenes}
        session={session}
        locationList={locations ?? [homeLocation]}
        characters={characters ?? []}
        editable={false}
        isMaster={false}
        homeLocation={homeLocation}
        compact
      />
    </div>
  );
}
