"use client";

import { useUrlTab } from "@/app/services/hooks/useUrlTab";
import { Logs, Map, MapPin, SearchCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

import PlayerSceneTab from "./PlayerSceneTab";
import PlayerCharacterTab from "./PlayerCharacterTab";
import PlayerSeenTab from "./PlayerSeenTab";
import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";
import PlayerLogTab from "./PlayerLogTab";
import PlayerMapTab from "./PlayerMapTab";
import { GameItem, Location } from "@/app/services/types2";

type Tab = "map" | "scene" | "character" | "log" | "seen";

const PLAYER_TABS: readonly Tab[] = ["scene", "map", "character", "log", "seen"];

const TABS: { id: Tab; label: string; Icon: typeof Map }[] = [
  { id: "scene", label: "Сцена", Icon: MapPin },
  { id: "map", label: "Карта", Icon: Map },
  { id: "character", label: "Герой", Icon: User },
  { id: "log", label: "Лог", Icon: Logs },
  { id: "seen", label: "Мир", Icon: SearchCheck },
];

interface PlayerPageProps {
  sessionId: string;
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;
  setEditingGameItem: (item: GameItem) => void;
}

export default function PlayerPage({
  sessionId,
  currentLocation,
  setCurrentLocation,
}: PlayerPageProps) {
  const { selfPlayer } = usePlayerSessionWebSocket(sessionId);
  const [activeTab, setActiveTab] = useUrlTab<Tab>(PLAYER_TABS, "scene");

  // Это основной экран роли, а не необязательный виджет: return null оставлял
  // игрока, вошедшего до назначения персонажа, перед пустотой без объяснений.
  if (!selfPlayer?.character_id) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-6 text-center">
        <User className="w-10 h-10 text-gray-500 mb-3" />
        <p className="text-white font-medium">Персонаж пока не назначен</p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm">
          Мастер ещё не выдал вам персонажа. Экран обновится сам, как только это
          произойдёт — страницу перезагружать не нужно.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-gray-900">
      <div className="flex-1 min-h-0 overflow-hidden px-2 pt-1 pb-1">
        {activeTab === "map" && <PlayerMapTab sessionId={sessionId} />}
        {activeTab === "scene" && <PlayerSceneTab sessionId={sessionId} />}
        {activeTab === "character" && <PlayerCharacterTab sessionId={sessionId} />}
        {activeTab === "log" && <PlayerLogTab sessionId={sessionId} />}
        {activeTab === "seen" && (
          <PlayerSeenTab
            sessionId={sessionId}
            currentLocation={currentLocation}
            setCurrentLocation={setCurrentLocation}
          />
        )}
      </div>

      <nav
        className="shrink-0 border-t border-gray-700 bg-gray-800/95 backdrop-blur-sm"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        aria-label="Навигация сессии"
      >
        <div className="grid grid-cols-5 gap-0.5 px-1 pt-1">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 px-0.5 min-h-[52px] transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-700/60 hover:text-gray-200",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-[10px] leading-tight font-medium truncate max-w-full">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
